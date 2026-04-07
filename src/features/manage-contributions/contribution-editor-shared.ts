import type { ContributionRow } from "@/hooks/use-contributions";

export type ContributionPayrollFrequency = NonNullable<
  ContributionRow["payrollFrequency"]
>;

export type ContributionScheduleValue = NonNullable<
  ContributionRow["sssSchedule"]
>;

export type ContributionFormState = {
  payrollFrequency: ContributionPayrollFrequency;
  currencyCode: string;
  sssEe: number;
  sssEr: number;
  isSssActive: boolean;
  sssSchedule: ContributionScheduleValue;
  philHealthEe: number;
  philHealthEr: number;
  isPhilHealthActive: boolean;
  philHealthSchedule: ContributionScheduleValue;
  pagIbigEe: number;
  pagIbigEr: number;
  isPagIbigActive: boolean;
  pagIbigSchedule: ContributionScheduleValue;
  withholdingEe: number;
  withholdingEr: number;
  isWithholdingActive: boolean;
  withholdingSchedule: ContributionScheduleValue;
};

export const payrollFrequencyOptions: Array<{
  value: ContributionPayrollFrequency;
  label: string;
}> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIMONTHLY", label: "Bi-monthly" },
  { value: "MONTHLY", label: "Monthly" },
];

export const contributionScheduleOptions: Array<{
  value: ContributionScheduleValue;
  label: string;
}> = [
  { value: "PER_PAYROLL", label: "Per payroll" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "AD_HOC", label: "Ad hoc" },
];

export const contributionEditorSections = [
  {
    label: "SSS",
    key: "sss",
    eeKey: "sssEe",
    erKey: "sssEr",
    activeKey: "isSssActive",
    scheduleKey: "sssSchedule",
    governmentIdKey: "sssNumber",
  },
  {
    label: "PhilHealth",
    key: "philHealth",
    eeKey: "philHealthEe",
    erKey: "philHealthEr",
    activeKey: "isPhilHealthActive",
    scheduleKey: "philHealthSchedule",
    governmentIdKey: "philHealthNumber",
  },
  {
    label: "Pag-IBIG",
    key: "pagIbig",
    eeKey: "pagIbigEe",
    erKey: "pagIbigEr",
    activeKey: "isPagIbigActive",
    scheduleKey: "pagIbigSchedule",
    governmentIdKey: "pagIbigNumber",
  },
  {
    label: "Tax",
    key: "withholding",
    eeKey: "withholdingEe",
    erKey: "withholdingEr",
    activeKey: "isWithholdingActive",
    scheduleKey: "withholdingSchedule",
    governmentIdKey: "tinNumber",
  },
] as const;

export const buildContributionFormState = (
  source?: Partial<ContributionFormState> | null
): ContributionFormState => ({
  payrollFrequency: source?.payrollFrequency ?? "BIMONTHLY",
  currencyCode: source?.currencyCode?.trim().toUpperCase() || "PHP",
  sssEe: source?.sssEe ?? 0,
  sssEr: source?.sssEr ?? 0,
  isSssActive: source?.isSssActive ?? true,
  sssSchedule: source?.sssSchedule ?? "PER_PAYROLL",
  philHealthEe: source?.philHealthEe ?? 0,
  philHealthEr: source?.philHealthEr ?? 0,
  isPhilHealthActive: source?.isPhilHealthActive ?? true,
  philHealthSchedule: source?.philHealthSchedule ?? "PER_PAYROLL",
  pagIbigEe: source?.pagIbigEe ?? 0,
  pagIbigEr: source?.pagIbigEr ?? 0,
  isPagIbigActive: source?.isPagIbigActive ?? true,
  pagIbigSchedule: source?.pagIbigSchedule ?? "PER_PAYROLL",
  withholdingEe: source?.withholdingEe ?? 0,
  withholdingEr: source?.withholdingEr ?? 0,
  isWithholdingActive: source?.isWithholdingActive ?? true,
  withholdingSchedule: source?.withholdingSchedule ?? "PER_PAYROLL",
});

export const formatContributionCurrency = (
  value: number,
  currencyCode = "PHP"
) => {
  const normalizedCurrency = currencyCode.trim().toUpperCase() || "PHP";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(value);
};

export const humanizeContributionSchedule = (
  schedule: ContributionScheduleValue
) =>
  contributionScheduleOptions.find((option) => option.value === schedule)
    ?.label ?? schedule;

export const humanizePayrollFrequency = (
  frequency: ContributionPayrollFrequency
) =>
  payrollFrequencyOptions.find((option) => option.value === frequency)?.label ??
  frequency;
