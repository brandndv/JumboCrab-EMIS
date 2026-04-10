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
  isIncludedInPayroll: boolean;
  governmentNumber: string | null;
  basisAmount: number | null;
  employeeShare: number;
  employerShare: number;
  bracketId: string | null;
  bracketReference: string | null;
  bracketRangeLabel: string | null;
  remarks: string | null;
};

export type ContributionBracketViewRow = {
  id: string;
  lowerBound: number;
  upperBound: number | null;
  employeeFixedAmount: number | null;
  employerFixedAmount: number | null;
  employeeRate: number | null;
  employerRate: number | null;
  baseTax: number | null;
  marginalRate: number | null;
  referenceCode: string | null;
};

export type ContributionBracketViewSection = {
  contributionType: ContributionType;
  title: string;
  description: string;
  rows: ContributionBracketViewRow[];
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
    isSssIncludedInPayroll: boolean;
    philHealthNumber: string | null;
    isPhilHealthIncludedInPayroll: boolean;
    pagIbigNumber: string | null;
    isPagIbigIncludedInPayroll: boolean;
    tinNumber: string | null;
    isWithholdingIncludedInPayroll: boolean;
    updatedAt: Date;
  } | null;
};

const DEFAULT_PREVIEW_FREQUENCY = PayrollFrequency.MONTHLY;

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
  isIncludedInPayroll: boolean,
): ContributionPreviewLine => ({
  contributionType,
  status,
  isIncludedInPayroll,
  governmentNumber,
  basisAmount: null,
  employeeShare: 0,
  employerShare: 0,
  bracketId: null,
  bracketReference: null,
  bracketRangeLabel: null,
  remarks,
});

const formatBracketRangeLabel = (input: {
  lowerBound: number;
  upperBound: number | null;
}) => {
  const formatValue = (value: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(value);

  if (input.upperBound == null) {
    return `${formatValue(input.lowerBound)} and above`;
  }

  return `${formatValue(input.lowerBound)} to ${formatValue(input.upperBound)}`;
};

const resolveGovernmentNumber = (
  employee: {
    governmentId?: {
      sssNumber?: string | null;
      philHealthNumber?: string | null;
      pagIbigNumber?: string | null;
      tinNumber?: string | null;
      isSssIncludedInPayroll?: boolean;
      isPhilHealthIncludedInPayroll?: boolean;
      isPagIbigIncludedInPayroll?: boolean;
      isWithholdingIncludedInPayroll?: boolean;
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

const resolvePayrollInclusion = (
  employee: {
    governmentId?: {
      isSssIncludedInPayroll?: boolean;
      isPhilHealthIncludedInPayroll?: boolean;
      isPagIbigIncludedInPayroll?: boolean;
      isWithholdingIncludedInPayroll?: boolean;
    } | null;
  },
  contributionType: ContributionType,
) => {
  if (contributionType === ContributionType.SSS) {
    return employee.governmentId?.isSssIncludedInPayroll ?? true;
  }
  if (contributionType === ContributionType.PHILHEALTH) {
    return employee.governmentId?.isPhilHealthIncludedInPayroll ?? true;
  }
  if (contributionType === ContributionType.PAGIBIG) {
    return employee.governmentId?.isPagIbigIncludedInPayroll ?? true;
  }
  return employee.governmentId?.isWithholdingIncludedInPayroll ?? true;
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
  isIncludedInPayroll: boolean;
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
      input.isIncludedInPayroll,
    );
  }

  const calculation = calculateContributionFromBracket({
    bracket,
    basisAmount: input.basisAmount,
  });

  return {
    contributionType: input.contributionType,
    status: "READY",
    isIncludedInPayroll: input.isIncludedInPayroll,
    governmentNumber: input.governmentNumber,
    basisAmount: calculation.basisAmount,
    employeeShare: calculation.employeeShare,
    employerShare: calculation.employerShare,
    bracketId: bracket.id,
    bracketReference: bracket.referenceCode ?? null,
    bracketRangeLabel: formatBracketRangeLabel({
      lowerBound: bracket.lowerBound,
      upperBound: bracket.upperBound,
    }),
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
      resolvePayrollInclusion(input.employee, contributionType),
    );

  const currentMonthlyRate = compensationSnapshot?.monthlyRate ?? null;
  const sssIncludedInPayroll = resolvePayrollInclusion(
    input.employee,
    ContributionType.SSS,
  );
  const philHealthIncludedInPayroll = resolvePayrollInclusion(
    input.employee,
    ContributionType.PHILHEALTH,
  );
  const pagIbigIncludedInPayroll = resolvePayrollInclusion(
    input.employee,
    ContributionType.PAGIBIG,
  );
  const withholdingIncludedInPayroll = resolvePayrollInclusion(
    input.employee,
    ContributionType.WITHHOLDING,
  );
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
            sssIncludedInPayroll,
          )
        : buildComputedLine({
            contributionType: ContributionType.SSS,
            basisAmount: currentMonthlyRate,
            governmentNumber: sssNumber,
            brackets: input.brackets,
            isIncludedInPayroll: sssIncludedInPayroll,
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
            philHealthIncludedInPayroll,
          )
        : buildComputedLine({
            contributionType: ContributionType.PHILHEALTH,
            basisAmount: currentMonthlyRate,
            governmentNumber: philHealthNumber,
            brackets: input.brackets,
            isIncludedInPayroll: philHealthIncludedInPayroll,
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
            pagIbigIncludedInPayroll,
          )
        : buildComputedLine({
            contributionType: ContributionType.PAGIBIG,
            basisAmount: currentMonthlyRate,
            governmentNumber: pagIbigNumber,
            brackets: input.brackets,
            isIncludedInPayroll: pagIbigIncludedInPayroll,
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
          isIncludedInPayroll: withholdingIncludedInPayroll,
        });

  const includedLines = [sss, philHealth, pagIbig, withholding].filter(
    (line) => line.isIncludedInPayroll,
  );

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
      includedLines.reduce((sum, line) => sum + line.employeeShare, 0),
    ),
    isReady:
      Boolean(compensationSnapshot?.dailyRate) &&
      [sss, philHealth, pagIbig].every(
        (line) => !line.isIncludedInPayroll || line.status === "READY",
      ),
    hasMissingGovernmentIds: [sss, philHealth, pagIbig].some(
      (line) =>
        line.isIncludedInPayroll && line.status === "MISSING_GOV_ID",
    ),
    updatedAt: (updatedAt ?? input.employee.updatedAt).toISOString(),
    sss,
    philHealth,
    pagIbig,
    withholding,
  } satisfies ContributionPreviewRecord;
};

async function loadContributionPreviewDirectory(input?: { employeeId?: string }) {
  const previewFrequency = DEFAULT_PREVIEW_FREQUENCY;
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
            isSssIncludedInPayroll: true,
            philHealthNumber: true,
            isPhilHealthIncludedInPayroll: true,
            pagIbigNumber: true,
            isPagIbigIncludedInPayroll: true,
            tinNumber: true,
            isWithholdingIncludedInPayroll: true,
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
}) {
  try {
    if (!input.employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    const rows = await loadContributionPreviewDirectory({
      employeeId: input.employeeId,
    });

    return { success: true, data: rows[0] ?? null };
  } catch (error) {
    console.error("Error fetching computed employee contribution:", error);
    return { success: false, error: "Failed to fetch contribution preview" };
  }
}

export async function listContributionDirectory() {
  try {
    const rows = await loadContributionPreviewDirectory();
    return { success: true, data: rows };
  } catch (error) {
    console.error("Error listing computed contributions:", error);
    return { success: false, error: "Failed to load contribution previews" };
  }
}

export async function listContributionBracketDirectory() {
  try {
    const previewFrequency = DEFAULT_PREVIEW_FREQUENCY;
    const brackets = await loadActiveContributionBrackets(new Date());

    const buildSection = (
      contributionType: ContributionType,
      title: string,
      description: string,
      rows: ContributionBracketViewRow[],
    ) => ({
      contributionType,
      title,
      description,
      rows,
    });

    const mapRows = (contributionType: ContributionType, payrollFrequency?: PayrollFrequency) =>
      brackets
        .filter((row) => {
          if (row.contributionType !== contributionType) return false;
          if (contributionType === ContributionType.WITHHOLDING) {
            return row.payrollFrequency === payrollFrequency;
          }
          return row.payrollFrequency == null;
        })
        .map((row) => ({
          id: row.id,
          lowerBound: row.lowerBound,
          upperBound: row.upperBound,
          employeeFixedAmount: row.employeeFixedAmount,
          employerFixedAmount: row.employerFixedAmount,
          employeeRate: row.employeeRate,
          employerRate: row.employerRate,
          baseTax: row.baseTax,
          marginalRate: row.marginalRate,
          referenceCode: row.referenceCode,
        }));

    const sections: ContributionBracketViewSection[] = [
      buildSection(
        ContributionType.SSS,
        "SSS Monthly Brackets",
        "Applied against the employee's monthly position rate.",
        mapRows(ContributionType.SSS),
      ),
      buildSection(
        ContributionType.PHILHEALTH,
        "PhilHealth Monthly Brackets",
        "Applied against the employee's monthly position rate.",
        mapRows(ContributionType.PHILHEALTH),
      ),
      buildSection(
        ContributionType.PAGIBIG,
        "Pag-IBIG Monthly Brackets",
        "Applied against the employee's monthly position rate.",
        mapRows(ContributionType.PAGIBIG),
      ),
      buildSection(
        ContributionType.WITHHOLDING,
        "Monthly Withholding Brackets",
        "Applied against the taxable monthly payroll amount for preview purposes.",
        mapRows(ContributionType.WITHHOLDING, previewFrequency),
      ),
    ];

    return { success: true, data: sections };
  } catch (error) {
    console.error("Error loading contribution brackets:", error);
    return { success: false, error: "Failed to load contribution brackets" };
  }
}
