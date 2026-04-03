"use server";

import {
  listPayrollRuns as listPayrollRunsImpl,
  getPayrollRunDetails as getPayrollRunDetailsImpl,
} from "./payroll-runs-action";
import {
  listPayrollEligibleEmployees as listPayrollEligibleEmployeesImpl,
  getPayrollGenerationReadiness as getPayrollGenerationReadinessImpl,
  generatePayrollRun as generatePayrollRunImpl,
  regenerateRejectedPayrollRun as regenerateRejectedPayrollRunImpl,
} from "./payroll-generation-action";
import {
  reviewPayrollRun as reviewPayrollRunImpl,
  releasePayrollRun as releasePayrollRunImpl,
} from "./payroll-review-action";
import {
  listPayrollPayslips as listPayrollPayslipsImpl,
  getPayrollEmployeeAttendance as getPayrollEmployeeAttendanceImpl,
  getPayrollPayslip as getPayrollPayslipImpl,
} from "./payroll-payslips-action";

export async function listPayrollRuns(
  ...args: Parameters<typeof listPayrollRunsImpl>
) {
  return listPayrollRunsImpl(...args);
}

export async function getPayrollRunDetails(
  ...args: Parameters<typeof getPayrollRunDetailsImpl>
) {
  return getPayrollRunDetailsImpl(...args);
}

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

export async function reviewPayrollRun(
  ...args: Parameters<typeof reviewPayrollRunImpl>
) {
  return reviewPayrollRunImpl(...args);
}

export async function releasePayrollRun(
  ...args: Parameters<typeof releasePayrollRunImpl>
) {
  return releasePayrollRunImpl(...args);
}

export async function listPayrollPayslips(
  ...args: Parameters<typeof listPayrollPayslipsImpl>
) {
  return listPayrollPayslipsImpl(...args);
}

export async function getPayrollEmployeeAttendance(
  ...args: Parameters<typeof getPayrollEmployeeAttendanceImpl>
) {
  return getPayrollEmployeeAttendanceImpl(...args);
}

export async function getPayrollPayslip(
  ...args: Parameters<typeof getPayrollPayslipImpl>
) {
  return getPayrollPayslipImpl(...args);
}
