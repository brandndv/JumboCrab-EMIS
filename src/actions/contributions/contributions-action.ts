"use server";

import { revalidatePath } from "next/cache";
import {
  ContributionBaseKind,
  ContributionCalculationMethod,
  ContributionType,
  PayrollDeductionType,
  PayrollFrequency,
  PayrollStatus,
  type Prisma,
  Roles,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
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
import {
  roundCurrency,
  toIsoString,
  toNumber,
  toNumberOrNull,
} from "@/lib/payroll/helpers";

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
  versionId: string | null;
  lowerBound: number;
  upperBound: number | null;
  employeeFixedAmount: number | null;
  employerFixedAmount: number | null;
  employeeRate: number | null;
  employerRate: number | null;
  baseTax: number | null;
  marginalRate: number | null;
  referenceCode: string | null;
  payrollFrequency: PayrollFrequency | null;
  effectiveFrom: string;
  effectiveTo: string | null;
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

export type EmployeeContributionDeductionRow = {
  id: string;
  payrollEmployeeId: string;
  payrollId: string;
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  payrollType: string;
  releasedAt: string | null;
  contributionType: ContributionType;
  deductionType: PayrollDeductionType;
  amount: number;
  employeeShare: number | null;
  employerShare: number | null;
  compensationBasis: number | null;
  payrollFrequency: PayrollFrequency | null;
  bracketReference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  remarks: string | null;
};

export type ContributionBracketVersionStatus =
  | "ACTIVE"
  | "FUTURE"
  | "EXPIRED";

export type ContributionBracketVersionSummary = {
  id: string;
  contributionType: ContributionType;
  payrollFrequency: PayrollFrequency | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  referenceCode: string | null;
  changeReason: string | null;
  createdByName: string | null;
  rowCount: number;
  status: ContributionBracketVersionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ContributionBracketVersionDetail =
  ContributionBracketVersionSummary & {
    rows: ContributionBracketViewRow[];
  };

export type ContributionBracketScheduleRowInput = {
  lowerBound: number | string;
  upperBound?: number | string | null;
  employeeFixedAmount?: number | string | null;
  employerFixedAmount?: number | string | null;
  employeeRate?: number | string | null;
  employerRate?: number | string | null;
  baseTax?: number | string | null;
  marginalRate?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

export type ReplaceContributionBracketScheduleInput = {
  contributionType: ContributionType;
  payrollFrequency?: PayrollFrequency | null;
  effectiveFrom: string | Date;
  referenceCode?: string | null;
  changeReason: string;
  rows: ContributionBracketScheduleRowInput[];
};

export type AdjustContributionBracketRowInput = {
  versionId: string;
  rowId: string;
  effectiveFrom: string | Date;
  referenceCode?: string | null;
  changeReason: string;
  row: ContributionBracketScheduleRowInput;
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

type NormalizedContributionBracketRow = {
  lowerBound: number;
  upperBound: number | null;
  employeeFixedAmount: number | null;
  employerFixedAmount: number | null;
  employeeRate: number | null;
  employerRate: number | null;
  baseTax: number | null;
  marginalRate: number | null;
  metadata?: Prisma.InputJsonObject | null;
};

const contributionBracketGroupFrequency = (
  contributionType: ContributionType,
  payrollFrequency?: PayrollFrequency | null,
) => (contributionType === ContributionType.WITHHOLDING ? payrollFrequency ?? null : null);

const contributionBracketMethod = (contributionType: ContributionType) => {
  if (contributionType === ContributionType.SSS) {
    return ContributionCalculationMethod.FIXED_AMOUNTS;
  }
  if (
    contributionType === ContributionType.PHILHEALTH ||
    contributionType === ContributionType.PAGIBIG
  ) {
    return ContributionCalculationMethod.PERCENT_OF_BASE;
  }
  return ContributionCalculationMethod.BASE_PLUS_PERCENT_OF_EXCESS;
};

const contributionBracketBaseKind = (contributionType: ContributionType) =>
  contributionType === ContributionType.WITHHOLDING
    ? ContributionBaseKind.PAYROLL_TAXABLE
    : ContributionBaseKind.MONTHLY_BASIC;

const toNullableInputNumber = (value: unknown) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRequiredInputNumber = (value: unknown, label: string) => {
  const parsed = toNullableInputNumber(value);
  if (parsed == null) {
    throw new Error(`${label} is required.`);
  }
  return parsed;
};

const parseEffectiveDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Effective date is invalid.");
  }
  return date;
};

const normalizeContributionBracketRows = (
  contributionType: ContributionType,
  rows: ContributionBracketScheduleRowInput[],
) => {
  if (!rows.length) {
    throw new Error("At least one bracket row is required.");
  }

  const normalized = rows
    .map((row, index): NormalizedContributionBracketRow => {
      const lowerBound = toRequiredInputNumber(
        row.lowerBound,
        `Row ${index + 1} lower bound`,
      );
      const upperBound = toNullableInputNumber(row.upperBound);

      if (lowerBound < 0) {
        throw new Error(`Row ${index + 1} lower bound cannot be negative.`);
      }
      if (upperBound != null && upperBound < lowerBound) {
        throw new Error(`Row ${index + 1} upper bound must be above lower bound.`);
      }

      const baseRow: NormalizedContributionBracketRow = {
        lowerBound,
        upperBound,
        employeeFixedAmount: null,
        employerFixedAmount: null,
        employeeRate: null,
        employerRate: null,
        baseTax: null,
        marginalRate: null,
        metadata:
          row.metadata &&
          typeof row.metadata === "object" &&
          !Array.isArray(row.metadata)
            ? (row.metadata as Prisma.InputJsonObject)
            : null,
      };

      if (contributionType === ContributionType.SSS) {
        baseRow.employeeFixedAmount = toRequiredInputNumber(
          row.employeeFixedAmount,
          `Row ${index + 1} employee fixed amount`,
        );
        baseRow.employerFixedAmount = toRequiredInputNumber(
          row.employerFixedAmount,
          `Row ${index + 1} employer fixed amount`,
        );
        return baseRow;
      }

      if (
        contributionType === ContributionType.PHILHEALTH ||
        contributionType === ContributionType.PAGIBIG
      ) {
        baseRow.employeeRate = toRequiredInputNumber(
          row.employeeRate,
          `Row ${index + 1} employee rate`,
        );
        baseRow.employerRate = toRequiredInputNumber(
          row.employerRate,
          `Row ${index + 1} employer rate`,
        );
        return baseRow;
      }

      baseRow.baseTax = toRequiredInputNumber(
        row.baseTax,
        `Row ${index + 1} base tax`,
      );
      baseRow.marginalRate = toRequiredInputNumber(
        row.marginalRate,
        `Row ${index + 1} marginal rate`,
      );
      baseRow.employerFixedAmount = toNullableInputNumber(row.employerFixedAmount) ?? 0;
      baseRow.employerRate = toNullableInputNumber(row.employerRate) ?? 0;
      return baseRow;
    })
    .sort((a, b) => a.lowerBound - b.lowerBound);

  normalized.forEach((row, index) => {
    if (row.upperBound == null && index !== normalized.length - 1) {
      throw new Error("Only the top bracket row can be open-ended.");
    }
    const next = normalized[index + 1];
    if (next && row.upperBound != null && row.upperBound >= next.lowerBound) {
      throw new Error("Bracket ranges must not overlap.");
    }
  });

  return normalized;
};

const canManageContributionBrackets = (role?: Roles | null) =>
  role === Roles.Admin || role === Roles.GeneralManager;

const canViewContributionBrackets = (role?: Roles | null) =>
  canManageContributionBrackets(role) || role === Roles.Manager;

const assertContributionBracketManager = async () => {
  const session = await getSession();
  if (!session.isLoggedIn || !canManageContributionBrackets(session.role)) {
    throw new Error("Unauthorized");
  }
  return session;
};

const assertContributionBracketViewer = async () => {
  const session = await getSession();
  if (!session.isLoggedIn || !canViewContributionBrackets(session.role)) {
    throw new Error("Unauthorized");
  }
  return session;
};

const revalidateContributionBracketPaths = () => {
  revalidatePath("/admin/contributions");
  revalidatePath("/manager/contributions");
  revalidatePath("/generalManager/contributions");
  revalidatePath("/employee/contributions");
  revalidatePath("/generalManager/reports/contributions");
  revalidatePath("/generalManager/reports/contributions-deductions");
  revalidatePath("/manager/reports/contributions");
  revalidatePath("/manager/reports/contributions-deductions");
};

const serializeBracketVersionStatus = (
  effectiveFrom: Date,
  effectiveTo: Date | null,
): ContributionBracketVersionStatus => {
  const now = new Date();
  if (effectiveFrom > now) return "FUTURE";
  if (effectiveTo && effectiveTo < now) return "EXPIRED";
  return "ACTIVE";
};

const serializeBracketVersionSummary = (version: {
  id: string;
  contributionType: ContributionType;
  payrollFrequency: PayrollFrequency | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  referenceCode: string | null;
  changeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { username: string; email: string } | null;
  _count: { brackets: number };
}): ContributionBracketVersionSummary => ({
  id: version.id,
  contributionType: version.contributionType,
  payrollFrequency: version.payrollFrequency ?? null,
  effectiveFrom: version.effectiveFrom.toISOString(),
  effectiveTo: toIsoString(version.effectiveTo),
  referenceCode: version.referenceCode ?? null,
  changeReason: version.changeReason ?? null,
  createdByName: version.createdBy?.username ?? version.createdBy?.email ?? null,
  rowCount: version._count.brackets,
  status: serializeBracketVersionStatus(version.effectiveFrom, version.effectiveTo),
  createdAt: version.createdAt.toISOString(),
  updatedAt: version.updatedAt.toISOString(),
});

const serializeBracketRow = (row: {
  id: string;
  versionId: string | null;
  lowerBound: Prisma.Decimal | number;
  upperBound: Prisma.Decimal | number | null;
  employeeFixedAmount: Prisma.Decimal | number | null;
  employerFixedAmount: Prisma.Decimal | number | null;
  employeeRate: Prisma.Decimal | number | null;
  employerRate: Prisma.Decimal | number | null;
  baseTax: Prisma.Decimal | number | null;
  marginalRate: Prisma.Decimal | number | null;
  referenceCode: string | null;
  payrollFrequency: PayrollFrequency | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}): ContributionBracketViewRow => ({
  id: row.id,
  versionId: row.versionId ?? null,
  lowerBound: toNumber(row.lowerBound, 0),
  upperBound: toNumberOrNull(row.upperBound),
  employeeFixedAmount: toNumberOrNull(row.employeeFixedAmount),
  employerFixedAmount: toNumberOrNull(row.employerFixedAmount),
  employeeRate: toNumberOrNull(row.employeeRate),
  employerRate: toNumberOrNull(row.employerRate),
  baseTax: toNumberOrNull(row.baseTax),
  marginalRate: toNumberOrNull(row.marginalRate),
  referenceCode: row.referenceCode ?? null,
  payrollFrequency: row.payrollFrequency ?? null,
  effectiveFrom: row.effectiveFrom.toISOString(),
  effectiveTo: toIsoString(row.effectiveTo),
});

async function assertNoReleasedPayrollConflict(
  client: Prisma.TransactionClient,
  contributionType: ContributionType,
  effectiveFrom: Date,
) {
  if (effectiveFrom.getTime() >= Date.now()) return;

  const releasedPayroll = await client.payrollDeduction.findFirst({
    where: {
      isVoided: false,
      contributionType,
      payrollEmployee: {
        payroll: {
          status: { in: [PayrollStatus.RELEASED, PayrollStatus.FINALIZED] },
          payrollPeriodEnd: { gte: effectiveFrom },
        },
      },
    },
    select: { id: true },
  });

  if (releasedPayroll) {
    throw new Error(
      "Past effective date is blocked because released payroll exists after that date.",
    );
  }
}

async function createContributionBracketVersion(
  client: Prisma.TransactionClient,
  input: ReplaceContributionBracketScheduleInput,
  createdByUserId: string | undefined,
) {
  const effectiveFrom = parseEffectiveDate(input.effectiveFrom);
  const payrollFrequency = contributionBracketGroupFrequency(
    input.contributionType,
    input.payrollFrequency,
  );

  if (input.contributionType === ContributionType.WITHHOLDING && !payrollFrequency) {
    throw new Error("Payroll frequency is required for withholding brackets.");
  }

  const rows = normalizeContributionBracketRows(input.contributionType, input.rows);
  const changeReason = input.changeReason?.trim();
  if (!changeReason) {
    throw new Error("Change reason is required.");
  }

  await assertNoReleasedPayrollConflict(client, input.contributionType, effectiveFrom);

  const exactVersion = await client.contributionBracketVersion.findFirst({
    where: {
      contributionType: input.contributionType,
      payrollFrequency,
      effectiveFrom,
    },
    select: { id: true },
  });

  if (exactVersion) {
    throw new Error("A bracket version already starts on that effective date.");
  }

  const nextVersion = await client.contributionBracketVersion.findFirst({
    where: {
      contributionType: input.contributionType,
      payrollFrequency,
      effectiveFrom: { gt: effectiveFrom },
    },
    orderBy: { effectiveFrom: "asc" },
    select: { effectiveFrom: true },
  });
  const effectiveTo = nextVersion
    ? new Date(nextVersion.effectiveFrom.getTime() - 1)
    : null;
  const closeAt = new Date(effectiveFrom.getTime() - 1);

  await client.contributionBracketVersion.updateMany({
    where: {
      contributionType: input.contributionType,
      payrollFrequency,
      effectiveFrom: { lt: effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    data: { effectiveTo: closeAt },
  });

  await client.contributionBracket.updateMany({
    where: {
      contributionType: input.contributionType,
      payrollFrequency,
      effectiveFrom: { lt: effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    data: { effectiveTo: closeAt },
  });

  const version = await client.contributionBracketVersion.create({
    data: {
      contributionType: input.contributionType,
      payrollFrequency,
      effectiveFrom,
      effectiveTo,
      referenceCode: input.referenceCode?.trim() || null,
      changeReason,
      createdByUserId,
      brackets: {
        create: rows.map((row) => ({
          contributionType: input.contributionType,
          calculationMethod: contributionBracketMethod(input.contributionType),
          baseKind: contributionBracketBaseKind(input.contributionType),
          payrollFrequency,
          lowerBound: row.lowerBound,
          upperBound: row.upperBound,
          employeeFixedAmount: row.employeeFixedAmount,
          employerFixedAmount: row.employerFixedAmount,
          employeeRate: row.employeeRate,
          employerRate: row.employerRate,
          baseTax: row.baseTax,
          marginalRate: row.marginalRate,
          effectiveFrom,
          effectiveTo,
          referenceCode: input.referenceCode?.trim() || null,
          metadata: row.metadata ?? undefined,
        })),
      },
    },
    select: { id: true },
  });

  return version.id;
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

export async function getMyContribution(): Promise<{
  success: boolean;
  data?: ContributionPreviewRecord | null;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== Roles.Employee) {
      return { success: false, error: "Unauthorized" };
    }

    if (!session.userId) {
      return { success: false, error: "Employee profile not found" };
    }

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: { employeeId: true },
    });

    if (!employee?.employeeId) {
      return { success: false, error: "Employee profile not found" };
    }

    const rows = await loadContributionPreviewDirectory({
      employeeId: employee.employeeId,
    });

    return { success: true, data: rows[0] ?? null };
  } catch (error) {
    console.error("Error fetching own contribution preview:", error);
    return { success: false, error: "Failed to fetch contribution preview" };
  }
}

export async function listMyContributionDeductions(): Promise<{
  success: boolean;
  data?: EmployeeContributionDeductionRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== Roles.Employee) {
      return { success: false, error: "Unauthorized" };
    }

    if (!session.userId) {
      return { success: false, error: "Employee profile not found" };
    }

    const employee = await db.employee.findUnique({
      where: { userId: session.userId },
      select: { employeeId: true },
    });

    if (!employee?.employeeId) {
      return { success: false, error: "Employee profile not found" };
    }

    const rows = await db.payrollDeduction.findMany({
      where: {
        isVoided: false,
        contributionType: { not: null },
        deductionType: {
          in: [
            PayrollDeductionType.CONTRIBUTION_SSS,
            PayrollDeductionType.CONTRIBUTION_PHILHEALTH,
            PayrollDeductionType.CONTRIBUTION_PAGIBIG,
            PayrollDeductionType.WITHHOLDING_TAX,
          ],
        },
        payrollEmployee: {
          employeeId: employee.employeeId,
          payroll: {
            status: PayrollStatus.RELEASED,
          },
        },
      },
      orderBy: [
        { payrollEmployee: { payroll: { payrollPeriodStart: "desc" } } },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        payrollEmployeeId: true,
        deductionType: true,
        contributionType: true,
        bracketReferenceSnapshot: true,
        payrollFrequency: true,
        periodStartSnapshot: true,
        periodEndSnapshot: true,
        compensationBasisSnapshot: true,
        employeeShareSnapshot: true,
        employerShareSnapshot: true,
        amount: true,
        remarks: true,
        payrollEmployee: {
          select: {
            payrollId: true,
            payroll: {
              select: {
                payrollPeriodStart: true,
                payrollPeriodEnd: true,
                payrollType: true,
                releasedAt: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        payrollEmployeeId: row.payrollEmployeeId,
        payrollId: row.payrollEmployee.payrollId,
        payrollPeriodStart:
          row.payrollEmployee.payroll.payrollPeriodStart.toISOString(),
        payrollPeriodEnd:
          row.payrollEmployee.payroll.payrollPeriodEnd.toISOString(),
        payrollType: row.payrollEmployee.payroll.payrollType,
        releasedAt: toIsoString(row.payrollEmployee.payroll.releasedAt),
        contributionType: row.contributionType!,
        deductionType: row.deductionType,
        amount: toNumber(row.amount, 0),
        employeeShare: toNumberOrNull(row.employeeShareSnapshot),
        employerShare: toNumberOrNull(row.employerShareSnapshot),
        compensationBasis: toNumberOrNull(row.compensationBasisSnapshot),
        payrollFrequency: row.payrollFrequency,
        bracketReference: row.bracketReferenceSnapshot ?? null,
        periodStart: toIsoString(row.periodStartSnapshot),
        periodEnd: toIsoString(row.periodEndSnapshot),
        remarks: row.remarks ?? null,
      })),
    };
  } catch (error) {
    console.error("Error listing own contribution deductions:", error);
    return { success: false, error: "Failed to load deducted contributions" };
  }
}

export async function listContributionBracketVersions(): Promise<{
  success: boolean;
  data?: ContributionBracketVersionSummary[];
  error?: string;
}> {
  try {
    await assertContributionBracketViewer();
    const versions = await db.contributionBracketVersion.findMany({
      orderBy: [
        { contributionType: "asc" },
        { payrollFrequency: "asc" },
        { effectiveFrom: "desc" },
      ],
      include: {
        createdBy: { select: { username: true, email: true } },
        _count: { select: { brackets: true } },
      },
    });

    return {
      success: true,
      data: versions.map(serializeBracketVersionSummary),
    };
  } catch (error) {
    console.error("Error listing contribution bracket versions:", error);
    return { success: false, error: "Failed to load bracket versions" };
  }
}

export async function getContributionBracketVersion(
  versionId: string,
): Promise<{
  success: boolean;
  data?: ContributionBracketVersionDetail | null;
  error?: string;
}> {
  try {
    if (!versionId) {
      return { success: false, error: "Version ID is required" };
    }
    await assertContributionBracketViewer();

    const version = await db.contributionBracketVersion.findUnique({
      where: { id: versionId },
      include: {
        createdBy: { select: { username: true, email: true } },
        _count: { select: { brackets: true } },
        brackets: { orderBy: { lowerBound: "asc" } },
      },
    });

    if (!version) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        ...serializeBracketVersionSummary(version),
        rows: version.brackets.map(serializeBracketRow),
      },
    };
  } catch (error) {
    console.error("Error loading contribution bracket version:", error);
    return { success: false, error: "Failed to load bracket version" };
  }
}

export async function replaceContributionBracketSchedule(
  input: ReplaceContributionBracketScheduleInput,
): Promise<{ success: boolean; data?: { versionId: string }; error?: string }> {
  try {
    const session = await assertContributionBracketManager();
    const versionId = await db.$transaction((tx) =>
      createContributionBracketVersion(tx, input, session.userId),
    );

    revalidateContributionBracketPaths();
    return { success: true, data: { versionId } };
  } catch (error) {
    console.error("Error replacing contribution bracket schedule:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update contribution bracket schedule",
    };
  }
}

export async function adjustContributionBracketRow(
  input: AdjustContributionBracketRowInput,
): Promise<{ success: boolean; data?: { versionId: string }; error?: string }> {
  try {
    const session = await assertContributionBracketManager();
    const versionId = await db.$transaction(async (tx) => {
      const sourceVersion = await tx.contributionBracketVersion.findUnique({
        where: { id: input.versionId },
        include: {
          brackets: { orderBy: { lowerBound: "asc" } },
        },
      });

      if (!sourceVersion) {
        throw new Error("Source bracket version was not found.");
      }

      const sourceRow = sourceVersion.brackets.find(
        (row) => row.id === input.rowId,
      );
      if (!sourceRow) {
        throw new Error("Bracket row was not found in the selected version.");
      }

      const clonedRows = sourceVersion.brackets.map((row) => {
        const rowInput =
          row.id === sourceRow.id
            ? input.row
            : {
                lowerBound: toNumber(row.lowerBound, 0),
                upperBound: toNumberOrNull(row.upperBound),
                employeeFixedAmount: toNumberOrNull(row.employeeFixedAmount),
                employerFixedAmount: toNumberOrNull(row.employerFixedAmount),
                employeeRate: toNumberOrNull(row.employeeRate),
                employerRate: toNumberOrNull(row.employerRate),
                baseTax: toNumberOrNull(row.baseTax),
                marginalRate: toNumberOrNull(row.marginalRate),
                metadata:
                  row.metadata &&
                  typeof row.metadata === "object" &&
                  !Array.isArray(row.metadata)
                    ? (row.metadata as Prisma.InputJsonObject)
                    : null,
              };
        return rowInput;
      });

      return createContributionBracketVersion(
        tx,
        {
          contributionType: sourceVersion.contributionType,
          payrollFrequency: sourceVersion.payrollFrequency,
          effectiveFrom: input.effectiveFrom,
          referenceCode:
            input.referenceCode?.trim() || sourceVersion.referenceCode || null,
          changeReason: input.changeReason,
          rows: clonedRows,
        },
        session.userId,
      );
    });

    revalidateContributionBracketPaths();
    return { success: true, data: { versionId } };
  } catch (error) {
    console.error("Error adjusting contribution bracket row:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to adjust bracket row",
    };
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
          versionId: row.versionId,
          lowerBound: row.lowerBound,
          upperBound: row.upperBound,
          employeeFixedAmount: row.employeeFixedAmount,
          employerFixedAmount: row.employerFixedAmount,
          employeeRate: row.employeeRate,
          employerRate: row.employerRate,
          baseTax: row.baseTax,
          marginalRate: row.marginalRate,
          referenceCode: row.referenceCode,
          payrollFrequency: row.payrollFrequency,
          effectiveFrom: row.effectiveFrom.toISOString(),
          effectiveTo: toIsoString(row.effectiveTo),
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
