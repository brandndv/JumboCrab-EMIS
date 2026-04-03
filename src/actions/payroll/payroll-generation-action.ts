"use server";

import {
  getPayrollGenerationReadiness as getPayrollGenerationReadinessImpl,
  listPayrollEligibleEmployees as listPayrollEligibleEmployeesImpl,
} from "./payroll-generation-query-action";
import {
  generatePayrollRun as generatePayrollRunImpl,
  regenerateRejectedPayrollRun as regenerateRejectedPayrollRunImpl,
} from "./payroll-generation-run-action";

export async function listPayrollEligibleEmployees(
  ...args: Parameters<typeof listPayrollEligibleEmployeesImpl>
) {
  return listPayrollEligibleEmployeesImpl(...args);
}

export async function getPayrollGenerationReadiness(
  ...args: Parameters<typeof getPayrollGenerationReadinessImpl>
) {
  return getPayrollGenerationReadinessImpl(...args);
}

export async function generatePayrollRun(
  ...args: Parameters<typeof generatePayrollRunImpl>
) {
  return generatePayrollRunImpl(...args);
}

export async function regenerateRejectedPayrollRun(
  ...args: Parameters<typeof regenerateRejectedPayrollRunImpl>
) {
  return regenerateRejectedPayrollRunImpl(...args);
}
