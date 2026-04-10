import "server-only";

import {
  ContributionCalculationMethod,
  ContributionType,
  type Prisma,
  type PayrollFrequency,
} from "@prisma/client";
import { db } from "@/lib/db";
import { roundCurrency, toNumber, toNumberOrNull } from "@/lib/payroll/helpers";

type JsonRecord = Record<string, unknown>;

export type ContributionBracketRecord = {
  id: string;
  contributionType: ContributionType;
  calculationMethod: ContributionCalculationMethod;
  payrollFrequency: PayrollFrequency | null;
  lowerBound: number;
  upperBound: number | null;
  employeeFixedAmount: number | null;
  employerFixedAmount: number | null;
  employeeRate: number | null;
  employerRate: number | null;
  baseTax: number | null;
  marginalRate: number | null;
  referenceCode: string | null;
  metadata: JsonRecord | null;
};

export type ContributionCalculationResult = {
  bracket: ContributionBracketRecord;
  basisAmount: number;
  employeeShare: number;
  employerShare: number;
  baseTax: number | null;
  marginalRate: number | null;
};

const serializeJsonRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
};

export async function loadActiveContributionBrackets(
  effectiveAt: Date,
  client?: Prisma.TransactionClient,
) {
  const rows = await (client ?? db).contributionBracket.findMany({
    where: {
      effectiveFrom: { lte: effectiveAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }],
    },
    orderBy: [
      { contributionType: "asc" },
      { payrollFrequency: "asc" },
      { lowerBound: "asc" },
    ],
    select: {
      id: true,
      contributionType: true,
      calculationMethod: true,
      payrollFrequency: true,
      lowerBound: true,
      upperBound: true,
      employeeFixedAmount: true,
      employerFixedAmount: true,
      employeeRate: true,
      employerRate: true,
      baseTax: true,
      marginalRate: true,
      referenceCode: true,
      metadata: true,
    },
  });

  return rows.map(
    (row): ContributionBracketRecord => ({
      id: row.id,
      contributionType: row.contributionType,
      calculationMethod: row.calculationMethod,
      payrollFrequency: row.payrollFrequency ?? null,
      lowerBound: toNumber(row.lowerBound, 0),
      upperBound: toNumberOrNull(row.upperBound),
      employeeFixedAmount: toNumberOrNull(row.employeeFixedAmount),
      employerFixedAmount: toNumberOrNull(row.employerFixedAmount),
      employeeRate: toNumberOrNull(row.employeeRate),
      employerRate: toNumberOrNull(row.employerRate),
      baseTax: toNumberOrNull(row.baseTax),
      marginalRate: toNumberOrNull(row.marginalRate),
      referenceCode: row.referenceCode ?? null,
      metadata: serializeJsonRecord(row.metadata),
    }),
  );
}

export const findApplicableContributionBracket = (input: {
  brackets: ContributionBracketRecord[];
  contributionType: ContributionType;
  payrollFrequency?: PayrollFrequency | null;
  basisAmount: number;
}) =>
  input.brackets.find((row) => {
    if (row.contributionType !== input.contributionType) return false;

    if (input.contributionType === ContributionType.WITHHOLDING) {
      if (row.payrollFrequency !== (input.payrollFrequency ?? null)) {
        return false;
      }
    } else if (row.payrollFrequency !== null) {
      return false;
    }

    if (input.basisAmount < row.lowerBound) return false;
    return row.upperBound == null || input.basisAmount <= row.upperBound;
  }) ?? null;

export const calculateContributionFromBracket = (input: {
  bracket: ContributionBracketRecord;
  basisAmount: number;
}) => {
  const { bracket } = input;
  const metadata = bracket.metadata ?? null;
  const metadataBasis =
    toNumberOrNull(metadata?.appliedBaseAmount) ??
    toNumberOrNull(metadata?.monthlySalaryCredit);
  const appliedBasis = metadataBasis ?? input.basisAmount;

  if (bracket.calculationMethod === ContributionCalculationMethod.FIXED_AMOUNTS) {
    return {
      bracket,
      basisAmount: roundCurrency(appliedBasis),
      employeeShare: roundCurrency(bracket.employeeFixedAmount ?? 0),
      employerShare: roundCurrency(bracket.employerFixedAmount ?? 0),
      baseTax: bracket.baseTax,
      marginalRate: bracket.marginalRate,
    } satisfies ContributionCalculationResult;
  }

  if (
    bracket.calculationMethod === ContributionCalculationMethod.PERCENT_OF_BASE
  ) {
    return {
      bracket,
      basisAmount: roundCurrency(appliedBasis),
      employeeShare: roundCurrency(appliedBasis * (bracket.employeeRate ?? 0)),
      employerShare: roundCurrency(appliedBasis * (bracket.employerRate ?? 0)),
      baseTax: bracket.baseTax,
      marginalRate: bracket.marginalRate,
    } satisfies ContributionCalculationResult;
  }

  const taxableExcess = Math.max(0, input.basisAmount - bracket.lowerBound);
  return {
    bracket,
    basisAmount: roundCurrency(input.basisAmount),
    employeeShare: roundCurrency(
      (bracket.baseTax ?? 0) + taxableExcess * (bracket.marginalRate ?? 0),
    ),
    employerShare: roundCurrency(
      (bracket.employerFixedAmount ?? 0) +
        taxableExcess * (bracket.employerRate ?? 0),
    ),
    baseTax: bracket.baseTax,
    marginalRate: bracket.marginalRate,
  } satisfies ContributionCalculationResult;
};
