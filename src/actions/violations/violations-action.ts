"use server";

import {
  getViolations as getViolationsImpl,
  listEmployeesForViolation as listEmployeesForViolationImpl,
  listEmployeeViolationResets as listEmployeeViolationResetsImpl,
  listViolationAutoResetPolicies as listViolationAutoResetPoliciesImpl,
  listViolationDefinitions as listViolationDefinitionsImpl,
  getEmployeeViolationStrikeProgress as getEmployeeViolationStrikeProgressImpl,
} from "./violations-query-action";
import {
  createViolationDefinition as createViolationDefinitionImpl,
  updateViolationDefinition as updateViolationDefinitionImpl,
} from "./violation-definitions-action";
import {
  createEmployeeViolation as createEmployeeViolationImpl,
  reviewEmployeeViolation as reviewEmployeeViolationImpl,
  setEmployeeViolationAcknowledged as setEmployeeViolationAcknowledgedImpl,
} from "./employee-violations-action";
import {
  createViolationAutoResetPolicy as createViolationAutoResetPolicyImpl,
  deleteViolationAutoResetPolicy as deleteViolationAutoResetPolicyImpl,
  resetEmployeeViolationStrikes as resetEmployeeViolationStrikesImpl,
  runDueViolationAutoResets as runDueViolationAutoResetsImpl,
  runViolationAutoResetPolicyNow as runViolationAutoResetPolicyNowImpl,
  setViolationAutoResetPolicyActive as setViolationAutoResetPolicyActiveImpl,
  updateViolationAutoResetPolicy as updateViolationAutoResetPolicyImpl,
} from "./violation-reset-action";

export async function getViolations(
  ...args: Parameters<typeof getViolationsImpl>
) {
  return getViolationsImpl(...args);
}

export async function listViolationDefinitions(
  ...args: Parameters<typeof listViolationDefinitionsImpl>
) {
  return listViolationDefinitionsImpl(...args);
}

export async function createViolationDefinition(
  ...args: Parameters<typeof createViolationDefinitionImpl>
) {
  return createViolationDefinitionImpl(...args);
}

export async function updateViolationDefinition(
  ...args: Parameters<typeof updateViolationDefinitionImpl>
) {
  return updateViolationDefinitionImpl(...args);
}

export async function listEmployeesForViolation(
  ...args: Parameters<typeof listEmployeesForViolationImpl>
) {
  return listEmployeesForViolationImpl(...args);
}

export async function createEmployeeViolation(
  ...args: Parameters<typeof createEmployeeViolationImpl>
) {
  return createEmployeeViolationImpl(...args);
}

export async function setEmployeeViolationAcknowledged(
  ...args: Parameters<typeof setEmployeeViolationAcknowledgedImpl>
) {
  return setEmployeeViolationAcknowledgedImpl(...args);
}

export async function reviewEmployeeViolation(
  ...args: Parameters<typeof reviewEmployeeViolationImpl>
) {
  return reviewEmployeeViolationImpl(...args);
}

export async function resetEmployeeViolationStrikes(
  ...args: Parameters<typeof resetEmployeeViolationStrikesImpl>
) {
  return resetEmployeeViolationStrikesImpl(...args);
}

export async function listEmployeeViolationResets(
  ...args: Parameters<typeof listEmployeeViolationResetsImpl>
) {
  return listEmployeeViolationResetsImpl(...args);
}

export async function createViolationAutoResetPolicy(
  ...args: Parameters<typeof createViolationAutoResetPolicyImpl>
) {
  return createViolationAutoResetPolicyImpl(...args);
}

export async function updateViolationAutoResetPolicy(
  ...args: Parameters<typeof updateViolationAutoResetPolicyImpl>
) {
  return updateViolationAutoResetPolicyImpl(...args);
}

export async function listViolationAutoResetPolicies(
  ...args: Parameters<typeof listViolationAutoResetPoliciesImpl>
) {
  return listViolationAutoResetPoliciesImpl(...args);
}

export async function setViolationAutoResetPolicyActive(
  ...args: Parameters<typeof setViolationAutoResetPolicyActiveImpl>
) {
  return setViolationAutoResetPolicyActiveImpl(...args);
}

export async function deleteViolationAutoResetPolicy(
  ...args: Parameters<typeof deleteViolationAutoResetPolicyImpl>
) {
  return deleteViolationAutoResetPolicyImpl(...args);
}

export async function runDueViolationAutoResets(
  ...args: Parameters<typeof runDueViolationAutoResetsImpl>
) {
  return runDueViolationAutoResetsImpl(...args);
}

export async function runViolationAutoResetPolicyNow(
  ...args: Parameters<typeof runViolationAutoResetPolicyNowImpl>
) {
  return runViolationAutoResetPolicyNowImpl(...args);
}

export async function getEmployeeViolationStrikeProgress(
  ...args: Parameters<typeof getEmployeeViolationStrikeProgressImpl>
) {
  return getEmployeeViolationStrikeProgressImpl(...args);
}

export type {
  EmployeeViolationResetRow,
  ViolationAutoResetPolicyRow,
  ViolationDefinitionOption,
  ViolationEmployeeOption,
  ViolationResetFrequencyValue,
  ViolationRow,
  ViolationStrikeProgressRow,
} from "./types";
