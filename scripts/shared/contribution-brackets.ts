import {
  ContributionBaseKind,
  ContributionCalculationMethod,
  ContributionType,
  PayrollFrequency,
  Prisma,
  PrismaClient,
} from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const decimal = (value: number | string) =>
  typeof value === "string"
    ? new Prisma.Decimal(value)
    : new Prisma.Decimal(value.toFixed(2));

const rateDecimal = (value: number) =>
  new Prisma.Decimal(value.toFixed(6));

const SSS_REFERENCE_CODE = "SSS-ER-EE-2025";
const PHILHEALTH_REFERENCE_CODE = "PHIC-2024-2025";
const PAGIBIG_REFERENCE_CODE = "PAGIBIG-CIRCULAR-274";
const WITHHOLDING_REFERENCE_CODE = "BIR-ANNEX-E-2023";

const buildSssRows = (effectiveFrom: Date): Prisma.ContributionBracketCreateManyInput[] => {
  const rows: Prisma.ContributionBracketCreateManyInput[] = [];

  for (let monthlySalaryCredit = 5_000; monthlySalaryCredit <= 35_000; monthlySalaryCredit += 500) {
    const lowerBound = monthlySalaryCredit === 5_000 ? 0 : monthlySalaryCredit - 250;
    const upperBound =
      monthlySalaryCredit === 35_000 ? null : monthlySalaryCredit + 249.99;
    const employeeShare = monthlySalaryCredit * 0.05;
    const employerShare =
      monthlySalaryCredit * 0.1 + (monthlySalaryCredit >= 15_000 ? 30 : 10);

    rows.push({
      contributionType: ContributionType.SSS,
      calculationMethod: ContributionCalculationMethod.FIXED_AMOUNTS,
      baseKind: ContributionBaseKind.MONTHLY_BASIC,
      payrollFrequency: null,
      lowerBound: decimal(lowerBound),
      upperBound: upperBound == null ? null : decimal(upperBound),
      employeeFixedAmount: decimal(employeeShare),
      employerFixedAmount: decimal(employerShare),
      employeeRate: null,
      employerRate: null,
      baseTax: null,
      marginalRate: null,
      effectiveFrom,
      effectiveTo: null,
      referenceCode: SSS_REFERENCE_CODE,
      metadata: {
        source: "SSS contribution schedule effective January 2025",
        monthlySalaryCredit,
        employeeRate: 0.05,
        employerRate: 0.1,
        employersCompensation: monthlySalaryCredit >= 15_000 ? 30 : 10,
      },
    });
  }

  return rows;
};

const buildPhilHealthRows = (
  effectiveFrom: Date,
): Prisma.ContributionBracketCreateManyInput[] => [
  {
    contributionType: ContributionType.PHILHEALTH,
    calculationMethod: ContributionCalculationMethod.PERCENT_OF_BASE,
    baseKind: ContributionBaseKind.MONTHLY_BASIC,
    payrollFrequency: null,
    lowerBound: decimal(0),
    upperBound: decimal(9_999.99),
    employeeFixedAmount: null,
    employerFixedAmount: null,
    employeeRate: rateDecimal(0.025),
    employerRate: rateDecimal(0.025),
    baseTax: null,
    marginalRate: null,
    effectiveFrom,
    effectiveTo: null,
    referenceCode: PHILHEALTH_REFERENCE_CODE,
    metadata: {
      source: "PhilHealth premium contribution table 2024-2025",
      appliedBaseAmount: 10_000,
      premiumRate: 0.05,
    },
  },
  {
    contributionType: ContributionType.PHILHEALTH,
    calculationMethod: ContributionCalculationMethod.PERCENT_OF_BASE,
    baseKind: ContributionBaseKind.MONTHLY_BASIC,
    payrollFrequency: null,
    lowerBound: decimal(10_000),
    upperBound: decimal(99_999.99),
    employeeFixedAmount: null,
    employerFixedAmount: null,
    employeeRate: rateDecimal(0.025),
    employerRate: rateDecimal(0.025),
    baseTax: null,
    marginalRate: null,
    effectiveFrom,
    effectiveTo: null,
    referenceCode: PHILHEALTH_REFERENCE_CODE,
    metadata: {
      source: "PhilHealth premium contribution table 2024-2025",
      premiumRate: 0.05,
    },
  },
  {
    contributionType: ContributionType.PHILHEALTH,
    calculationMethod: ContributionCalculationMethod.PERCENT_OF_BASE,
    baseKind: ContributionBaseKind.MONTHLY_BASIC,
    payrollFrequency: null,
    lowerBound: decimal(100_000),
    upperBound: null,
    employeeFixedAmount: null,
    employerFixedAmount: null,
    employeeRate: rateDecimal(0.025),
    employerRate: rateDecimal(0.025),
    baseTax: null,
    marginalRate: null,
    effectiveFrom,
    effectiveTo: null,
    referenceCode: PHILHEALTH_REFERENCE_CODE,
    metadata: {
      source: "PhilHealth premium contribution table 2024-2025",
      appliedBaseAmount: 100_000,
      premiumRate: 0.05,
    },
  },
];

const buildPagIbigRows = (
  effectiveFrom: Date,
): Prisma.ContributionBracketCreateManyInput[] => [
  {
    contributionType: ContributionType.PAGIBIG,
    calculationMethod: ContributionCalculationMethod.PERCENT_OF_BASE,
    baseKind: ContributionBaseKind.MONTHLY_BASIC,
    payrollFrequency: null,
    lowerBound: decimal(0),
    upperBound: decimal(1_499.99),
    employeeFixedAmount: null,
    employerFixedAmount: null,
    employeeRate: rateDecimal(0.01),
    employerRate: rateDecimal(0.02),
    baseTax: null,
    marginalRate: null,
    effectiveFrom,
    effectiveTo: null,
    referenceCode: PAGIBIG_REFERENCE_CODE,
    metadata: {
      source: "Pag-IBIG membership contribution rule",
      employeeRate: 0.01,
      employerRate: 0.02,
    },
  },
  {
    contributionType: ContributionType.PAGIBIG,
    calculationMethod: ContributionCalculationMethod.PERCENT_OF_BASE,
    baseKind: ContributionBaseKind.MONTHLY_BASIC,
    payrollFrequency: null,
    lowerBound: decimal(1_500),
    upperBound: decimal(4_999.99),
    employeeFixedAmount: null,
    employerFixedAmount: null,
    employeeRate: rateDecimal(0.02),
    employerRate: rateDecimal(0.02),
    baseTax: null,
    marginalRate: null,
    effectiveFrom,
    effectiveTo: null,
    referenceCode: PAGIBIG_REFERENCE_CODE,
    metadata: {
      source: "Pag-IBIG membership contribution rule",
      employeeRate: 0.02,
      employerRate: 0.02,
    },
  },
  {
    contributionType: ContributionType.PAGIBIG,
    calculationMethod: ContributionCalculationMethod.PERCENT_OF_BASE,
    baseKind: ContributionBaseKind.MONTHLY_BASIC,
    payrollFrequency: null,
    lowerBound: decimal(5_000),
    upperBound: null,
    employeeFixedAmount: null,
    employerFixedAmount: null,
    employeeRate: rateDecimal(0.02),
    employerRate: rateDecimal(0.02),
    baseTax: null,
    marginalRate: null,
    effectiveFrom,
    effectiveTo: null,
    referenceCode: PAGIBIG_REFERENCE_CODE,
    metadata: {
      source: "Pag-IBIG membership contribution rule",
      appliedBaseAmount: 5_000,
      employeeRate: 0.02,
      employerRate: 0.02,
    },
  },
];

const buildWithholdingRows = (
  effectiveFrom: Date,
  payrollFrequency: PayrollFrequency,
  rows: Array<{
    lowerBound: number;
    upperBound: number | null;
    baseTax: number;
    marginalRate: number;
  }>,
): Prisma.ContributionBracketCreateManyInput[] =>
  rows.map((row) => ({
    contributionType: ContributionType.WITHHOLDING,
    calculationMethod:
      ContributionCalculationMethod.BASE_PLUS_PERCENT_OF_EXCESS,
    baseKind: ContributionBaseKind.PAYROLL_TAXABLE,
    payrollFrequency,
    lowerBound: decimal(row.lowerBound),
    upperBound: row.upperBound == null ? null : decimal(row.upperBound),
    employeeFixedAmount: null,
    employerFixedAmount: decimal(0),
    employeeRate: null,
    employerRate: rateDecimal(0),
    baseTax: decimal(row.baseTax),
    marginalRate: rateDecimal(row.marginalRate),
    effectiveFrom,
    effectiveTo: null,
    referenceCode: WITHHOLDING_REFERENCE_CODE,
    metadata: {
      source: "BIR Annex E revised withholding tax table effective January 1, 2023",
    },
  }));

export const getContributionBracketSeedRows = (input: {
  sssEffectiveFrom: Date;
  philHealthEffectiveFrom: Date;
  pagIbigEffectiveFrom: Date;
  withholdingEffectiveFrom: Date;
}) => [
  ...buildSssRows(input.sssEffectiveFrom),
  ...buildPhilHealthRows(input.philHealthEffectiveFrom),
  ...buildPagIbigRows(input.pagIbigEffectiveFrom),
  ...buildWithholdingRows(input.withholdingEffectiveFrom, PayrollFrequency.WEEKLY, [
    { lowerBound: 0, upperBound: 4_808, baseTax: 0, marginalRate: 0 },
    { lowerBound: 4_808, upperBound: 7_691.99, baseTax: 0, marginalRate: 0.15 },
    { lowerBound: 7_692, upperBound: 15_384.99, baseTax: 432.6, marginalRate: 0.2 },
    { lowerBound: 15_385, upperBound: 38_461.99, baseTax: 1_971.2, marginalRate: 0.25 },
    { lowerBound: 38_462, upperBound: 153_845.99, baseTax: 7_740.45, marginalRate: 0.3 },
    { lowerBound: 153_846, upperBound: null, baseTax: 42_355.65, marginalRate: 0.35 },
  ]),
  ...buildWithholdingRows(
    input.withholdingEffectiveFrom,
    PayrollFrequency.BIMONTHLY,
    [
      { lowerBound: 0, upperBound: 10_417, baseTax: 0, marginalRate: 0 },
      { lowerBound: 10_417, upperBound: 16_666.99, baseTax: 0, marginalRate: 0.15 },
      { lowerBound: 16_667, upperBound: 33_332.99, baseTax: 937.5, marginalRate: 0.2 },
      { lowerBound: 33_333, upperBound: 83_332.99, baseTax: 4_270.7, marginalRate: 0.25 },
      { lowerBound: 83_333, upperBound: 333_332.99, baseTax: 16_770.7, marginalRate: 0.3 },
      { lowerBound: 333_333, upperBound: null, baseTax: 91_770.7, marginalRate: 0.35 },
    ],
  ),
  ...buildWithholdingRows(input.withholdingEffectiveFrom, PayrollFrequency.MONTHLY, [
    { lowerBound: 0, upperBound: 20_833, baseTax: 0, marginalRate: 0 },
    { lowerBound: 20_833, upperBound: 33_332.99, baseTax: 0, marginalRate: 0.15 },
    { lowerBound: 33_333, upperBound: 66_666.99, baseTax: 1_875, marginalRate: 0.2 },
    { lowerBound: 66_667, upperBound: 166_666.99, baseTax: 8_541.8, marginalRate: 0.25 },
    { lowerBound: 166_667, upperBound: 666_666.99, baseTax: 33_541.8, marginalRate: 0.3 },
    { lowerBound: 666_667, upperBound: null, baseTax: 183_541.8, marginalRate: 0.35 },
  ]),
];

export async function seedContributionBrackets(
  prisma: PrismaLike,
  input: {
    sssEffectiveFrom: Date;
    philHealthEffectiveFrom: Date;
    pagIbigEffectiveFrom: Date;
    withholdingEffectiveFrom: Date;
  },
) {
  await prisma.contributionBracket.deleteMany({});
  await prisma.contributionBracket.createMany({
    data: getContributionBracketSeedRows(input),
  });
}
