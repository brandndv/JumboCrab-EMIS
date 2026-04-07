"use server";

import { ContributionType, PayrollFrequency } from "@prisma/client";
import { db } from "@/lib/db";
import {
  calculateContributionFromBracket,
  findApplicableContributionBracket,
  loadActiveContributionBrackets,
} from "@/lib/payroll/contribution-brackets";
import {
  buildCompensationLookupKey,
  resolveEmployeeCompensationSnapshots,
  type CompensationSnapshot,
} from "@/lib/payroll/compensation";
import { roundCurrency } from "@/lib/payroll/helpers";

export type ContributionPreviewStatus =
  | "READY"
  | "MISSING_POSITION_RATE"
  | "MISSING_GOV_ID"
  | "NO_BRACKET";

export type ContributionPreviewLine = {
  contributionType: ContributionType;
  status: ContributionPreviewStatus;
  governmentNumber: string | null;
  basisAmount: number | null;
  employeeShare: number;
  employerShare: number;
  bracketId: string | null;
  bracketReference: string | null;
  remarks: string | null;
};

export type ContributionPreviewRecord = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  avatarUrl: string | null;
  departmentId: string | null;
  department: string;
  positionName: string | null;
  dailyRate: number | null;
  monthlyRate: number | null;
  currencyCode: string;
  previewFrequency: PayrollFrequency;
  eeTotal: number;
  isReady: boolean;
  hasMissingGovernmentIds: boolean;
  updatedAt: string;
  sss: ContributionPreviewLine;
  philHealth: ContributionPreviewLine;
  pagIbig: ContributionPreviewLine;
  withholding: ContributionPreviewLine;
};

type ContributionPreviewEmployee = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  img: string | null;
  departmentId: string | null;
  updatedAt: Date;
  department: { name: string } | null;
  position: { name: string; updatedAt: Date } | null;
  governmentId: {
    sssNumber: string | null;
    philHealthNumber: string | null;
    pagIbigNumber: string | null;
    tinNumber: string | null;
    updatedAt: Date;
  } | null;
};

const DEFAULT_PREVIEW_FREQUENCY = PayrollFrequency.BIMONTHLY;

const payrollFrequencyPreviewDivisor = (frequency: PayrollFrequency) => {
  if (frequency === PayrollFrequency.WEEKLY) return 4;
  if (frequency === PayrollFrequency.MONTHLY) return 1;
  return 2;
};

const buildEmptyLine = (
  contributionType: ContributionType,
  status: ContributionPreviewStatus,
  remarks: string,
  governmentNumber: string | null,
): ContributionPreviewLine => ({
  contributionType,
  status,
  governmentNumber,
  basisAmount: null,
  employeeShare: 0,
  employerShare: 0,
  bracketId: null,
  bracketReference: null,
  remarks,
});

const resolveGovernmentNumber = (
  employee: {
    governmentId?: {
      sssNumber?: string | null;
      philHealthNumber?: string | null;
      pagIbigNumber?: string | null;
      tinNumber?: string | null;
    } | null;
  },
  contributionType: ContributionType,
) => {
  if (contributionType === ContributionType.SSS) {
    return employee.governmentId?.sssNumber?.trim() || null;
  }
  if (contributionType === ContributionType.PHILHEALTH) {
    return employee.governmentId?.philHealthNumber?.trim() || null;
  }
  if (contributionType === ContributionType.PAGIBIG) {
    return employee.governmentId?.pagIbigNumber?.trim() || null;
  }
  return employee.governmentId?.tinNumber?.trim() || null;
};

const latestTimestamp = (...values: Array<Date | null | undefined>) =>
  values
    .filter((value): value is Date => value instanceof Date)
    .reduce<Date | null>(
      (latest, value) =>
        !latest || value.getTime() > latest.getTime() ? value : latest,
      null,
    );

const buildComputedLine = (input: {
  contributionType: ContributionType;
  basisAmount: number;
  governmentNumber: string | null;
  previewFrequency?: PayrollFrequency;
  brackets: Awaited<ReturnType<typeof loadActiveContributionBrackets>>;
}) => {
  const bracket = findApplicableContributionBracket({
    brackets: input.brackets,
    contributionType: input.contributionType,
    payrollFrequency:
      input.contributionType === ContributionType.WITHHOLDING
        ? input.previewFrequency
        : undefined,
    basisAmount: input.basisAmount,
  });

  if (!bracket) {
    return buildEmptyLine(
      input.contributionType,
      "NO_BRACKET",
      "No active official bracket matched the current rate basis.",
      input.governmentNumber,
    );
  }

  const calculation = calculateContributionFromBracket({
    bracket,
    basisAmount: input.basisAmount,
  });

  return {
    contributionType: input.contributionType,
    status: "READY",
    governmentNumber: input.governmentNumber,
    basisAmount: calculation.basisAmount,
    employeeShare: calculation.employeeShare,
    employerShare: calculation.employerShare,
    bracketId: bracket.id,
    bracketReference: bracket.referenceCode ?? null,
    remarks: null,
  } satisfies ContributionPreviewLine;
};

const buildContributionRecord = (input: {
  employee: ContributionPreviewEmployee;
  previewFrequency: PayrollFrequency;
  brackets: Awaited<ReturnType<typeof loadActiveContributionBrackets>>;
  effectiveToday: Map<string, CompensationSnapshot | null>;
  todayKey: string;
}) => {
  const compensationSnapshot =
    input.effectiveToday.get(
      buildCompensationLookupKey(input.employee.employeeId, input.todayKey),
    ) ?? null;

  const employeeName = [
    input.employee.firstName,
    input.employee.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const currencyCode = compensationSnapshot?.currencyCode ?? "PHP";

  const missingRateLine = (contributionType: ContributionType) =>
    buildEmptyLine(
      contributionType,
      "MISSING_POSITION_RATE",
      "Assign an active position with a saved rate first.",
      resolveGovernmentNumber(input.employee, contributionType),
    );

  const currentMonthlyRate = compensationSnapshot?.monthlyRate ?? null;
  const sssNumber = resolveGovernmentNumber(input.employee, ContributionType.SSS);
  const philHealthNumber = resolveGovernmentNumber(
    input.employee,
    ContributionType.PHILHEALTH,
  );
  const pagIbigNumber = resolveGovernmentNumber(
    input.employee,
    ContributionType.PAGIBIG,
  );
  const tinNumber = resolveGovernmentNumber(
    input.employee,
    ContributionType.WITHHOLDING,
  );

  const sss =
    currentMonthlyRate == null
      ? missingRateLine(ContributionType.SSS)
      : !sssNumber
        ? buildEmptyLine(
            ContributionType.SSS,
            "MISSING_GOV_ID",
            "SSS number is missing.",
            null,
          )
        : buildComputedLine({
            contributionType: ContributionType.SSS,
            basisAmount: currentMonthlyRate,
            governmentNumber: sssNumber,
            brackets: input.brackets,
          });

  const philHealth =
    currentMonthlyRate == null
      ? missingRateLine(ContributionType.PHILHEALTH)
      : !philHealthNumber
        ? buildEmptyLine(
            ContributionType.PHILHEALTH,
            "MISSING_GOV_ID",
            "PhilHealth number is missing.",
            null,
          )
        : buildComputedLine({
            contributionType: ContributionType.PHILHEALTH,
            basisAmount: currentMonthlyRate,
            governmentNumber: philHealthNumber,
            brackets: input.brackets,
          });

  const pagIbig =
    currentMonthlyRate == null
      ? missingRateLine(ContributionType.PAGIBIG)
      : !pagIbigNumber
        ? buildEmptyLine(
            ContributionType.PAGIBIG,
            "MISSING_GOV_ID",
            "Pag-IBIG number is missing.",
            null,
          )
        : buildComputedLine({
            contributionType: ContributionType.PAGIBIG,
            basisAmount: currentMonthlyRate,
            governmentNumber: pagIbigNumber,
            brackets: input.brackets,
          });

  const withholdingBasis =
    currentMonthlyRate == null
      ? null
      : roundCurrency(
          currentMonthlyRate /
            payrollFrequencyPreviewDivisor(input.previewFrequency),
        );
  const withholding =
    withholdingBasis == null
      ? missingRateLine(ContributionType.WITHHOLDING)
      : buildComputedLine({
          contributionType: ContributionType.WITHHOLDING,
          basisAmount: withholdingBasis,
          governmentNumber: tinNumber,
          previewFrequency: input.previewFrequency,
          brackets: input.brackets,
        });

  const updatedAt = latestTimestamp(
    input.employee.updatedAt,
    input.employee.governmentId?.updatedAt,
    input.employee.position?.updatedAt,
  );

  return {
    employeeId: input.employee.employeeId,
    employeeCode: input.employee.employeeCode,
    employeeName: employeeName || "Unnamed Employee",
    avatarUrl: input.employee.img ?? null,
    departmentId: input.employee.departmentId ?? null,
    department: input.employee.department?.name ?? "",
    positionName: compensationSnapshot?.positionName ?? input.employee.position?.name ?? null,
    dailyRate: compensationSnapshot?.dailyRate ?? null,
    monthlyRate: compensationSnapshot?.monthlyRate ?? null,
    currencyCode,
    previewFrequency: input.previewFrequency,
    eeTotal: roundCurrency(
      sss.employeeShare +
        philHealth.employeeShare +
        pagIbig.employeeShare +
        withholding.employeeShare,
    ),
    isReady:
      Boolean(compensationSnapshot?.dailyRate) &&
      [sss, philHealth, pagIbig, withholding].every(
        (line) => line.status === "READY" || line.contributionType === ContributionType.WITHHOLDING,
      ),
    hasMissingGovernmentIds: [sss, philHealth, pagIbig].some(
      (line) => line.status === "MISSING_GOV_ID",
    ),
    updatedAt: (updatedAt ?? input.employee.updatedAt).toISOString(),
    sss,
    philHealth,
    pagIbig,
    withholding,
  } satisfies ContributionPreviewRecord;
};

async function loadContributionPreviewDirectory(input?: {
  previewFrequency?: PayrollFrequency;
  employeeId?: string;
}) {
  const previewFrequency = input?.previewFrequency ?? DEFAULT_PREVIEW_FREQUENCY;
  const today = new Date();
  const todayKey = today.toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

  const [employees, brackets] = await Promise.all([
    db.employee.findMany({
      where: {
        currentStatus: {
          notIn: ["INACTIVE", "ENDED"],
        },
        isArchived: false,
        ...(input?.employeeId ? { employeeId: input.employeeId } : {}),
      },
      orderBy: { lastName: "asc" },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        img: true,
        departmentId: true,
        updatedAt: true,
        department: { select: { name: true } },
        position: {
          select: {
            name: true,
            updatedAt: true,
          },
        },
        governmentId: {
          select: {
            sssNumber: true,
            philHealthNumber: true,
            pagIbigNumber: true,
            tinNumber: true,
            updatedAt: true,
          },
        },
      },
    }),
    loadActiveContributionBrackets(today),
  ]);

  const effectiveToday = await resolveEmployeeCompensationSnapshots({
    employeeDates: new Map(
      employees.map((employee) => [employee.employeeId, [today]]),
    ),
  });

  return Promise.all(
    employees.map((employee) =>
      buildContributionRecord({
        employee,
        previewFrequency,
        brackets,
        effectiveToday,
        todayKey,
      }),
    ),
  );
}

export async function getEmployeeContribution(input: {
  employeeId: string | undefined;
  previewFrequency?: PayrollFrequency;
}) {
  try {
    if (!input.employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    const rows = await loadContributionPreviewDirectory({
      employeeId: input.employeeId,
      previewFrequency: input.previewFrequency,
    });

    return { success: true, data: rows[0] ?? null };
  } catch (error) {
    console.error("Error fetching computed employee contribution:", error);
    return { success: false, error: "Failed to fetch contribution preview" };
  }
}

export async function listContributionDirectory(input?: {
  previewFrequency?: PayrollFrequency;
}) {
  try {
    const rows = await loadContributionPreviewDirectory(input);
    return { success: true, data: rows };
  } catch (error) {
    console.error("Error listing computed contributions:", error);
    return { success: false, error: "Failed to load contribution previews" };
  }
}
