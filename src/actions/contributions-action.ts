"use server";

// Placeholder server actions for contributions. Wire these up once the
// Contribution model/schema is added.

type ContributionPayload = {
  employeeId: string | undefined;
  payload?: Record<string, unknown>;
};

export async function getContributions(
  employeeId: string | undefined
): Promise<{
  success: boolean;
  data?: null;
  error?: string;
}> {
  if (!employeeId) {
    return { success: false, error: "Employee ID is required" };
  }

  return {
    success: false,
    data: null,
    error: "Contribution model not implemented yet",
  };
}

export async function upsertContribution(
  input: ContributionPayload
): Promise<{
  success: boolean;
  data?: null;
  error?: string;
}> {
  if (!input.employeeId) {
    return { success: false, error: "Employee ID is required" };
  }

  return {
    success: false,
    data: null,
    error: "Contribution model not implemented yet",
  };
}
