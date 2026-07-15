"use server";

import { LeaveCreditResetRunType, LeaveCreditType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canManageLeaveCredits,
  employeeRequestSelect,
} from "./requests-shared";
import {
  ensureLeaveCreditPolicies,
  runLeaveCreditResetForType,
} from "./requests-leave-credit-shared";
import {
  serializeEmployeeLeaveCreditLedger,
  serializeLeaveCreditPolicy,
  serializeLeaveCreditResetRun,
} from "./requests-serializers-shared";
import type {
  EmployeeLeaveCreditLedgerRow,
  LeaveCreditPolicyRow,
  LeaveCreditResetRunRow,
} from "./types";

export async function listLeaveCreditPolicies(): Promise<{
  success: boolean;
  data?: LeaveCreditPolicyRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageLeaveCredits(session.role)) {
      return { success: false, error: "You are not allowed to view leave credit policies." };
    }

    const rows = await ensureLeaveCreditPolicies(db);
    return { success: true, data: rows.map(serializeLeaveCreditPolicy) };
  } catch (error) {
    console.error("Error listing leave credit policies:", error);
    return { success: false, error: "Failed to load leave credit policies." };
  }
}

export async function updateLeaveCreditPolicy(input: {
  leaveType: LeaveCreditType;
  resetMonth: number;
  resetDay: number;
  annualCredits: number;
}): Promise<{
  success: boolean;
  data?: LeaveCreditPolicyRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageLeaveCredits(session.role)) {
      return { success: false, error: "You are not allowed to update leave credit policies." };
    }

    const row = await db.leaveCreditPolicy.upsert({
      where: { leaveType: input.leaveType },
      update: {
        resetMonth: Math.max(1, Math.min(12, Math.floor(input.resetMonth))),
        resetDay: Math.max(1, Math.min(31, Math.floor(input.resetDay))),
        annualCredits: Math.max(0, Math.floor(input.annualCredits)),
      },
      create: {
        leaveType: input.leaveType,
        resetMonth: Math.max(1, Math.min(12, Math.floor(input.resetMonth))),
        resetDay: Math.max(1, Math.min(31, Math.floor(input.resetDay))),
        annualCredits: Math.max(0, Math.floor(input.annualCredits)),
      },
    });

    return { success: true, data: serializeLeaveCreditPolicy(row) };
  } catch (error) {
    console.error("Error updating leave credit policy:", error);
    return { success: false, error: "Failed to update leave credit policy." };
  }
}

export async function runLeaveCreditReset(input: {
  leaveType: LeaveCreditType;
  effectiveDate?: string | Date | null;
  notes?: string | null;
}): Promise<{
  success: boolean;
  data?: LeaveCreditResetRunRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageLeaveCredits(session.role)) {
      return { success: false, error: "You are not allowed to run leave credit resets." };
    }

    const run = await db.$transaction((tx) =>
      runLeaveCreditResetForType({
        client: tx,
        leaveType: input.leaveType,
        effectiveDate:
          input.effectiveDate instanceof Date
            ? input.effectiveDate
            : input.effectiveDate
              ? new Date(input.effectiveDate)
              : new Date(),
        initiatedByUserId: session.userId ?? null,
        notes: input.notes ?? null,
        runType: LeaveCreditResetRunType.MANUAL,
      }),
    );

    const row = await db.leaveCreditResetRun.findUnique({ where: { id: run.id } });
    if (!row) {
      return { success: false, error: "Leave credit reset run was not found after creation." };
    }

    return { success: true, data: serializeLeaveCreditResetRun(row) };
  } catch (error) {
    console.error("Error running leave credit reset:", error);
    return { success: false, error: "Failed to run leave credit reset." };
  }
}

export async function listLeaveCreditResetRuns(input?: {
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: LeaveCreditResetRunRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageLeaveCredits(session.role)) {
      return { success: false, error: "You are not allowed to view leave credit reset history." };
    }

    const rows = await db.leaveCreditResetRun.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: Math.max(1, Math.min(input?.limit ?? 20, 200)),
    });

    return { success: true, data: rows.map(serializeLeaveCreditResetRun) };
  } catch (error) {
    console.error("Error listing leave credit reset runs:", error);
    return { success: false, error: "Failed to load leave credit reset history." };
  }
}

export async function listEmployeeLeaveCreditLedger(input?: {
  employeeId?: string | null;
  leaveType?: LeaveCreditType | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: EmployeeLeaveCreditLedgerRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageLeaveCredits(session.role)) {
      return { success: false, error: "You are not allowed to view leave credit history." };
    }

    const rows = await db.employeeLeaveCreditLedger.findMany({
      where: {
        employeeId: input?.employeeId?.trim() || undefined,
        leaveType: input?.leaveType ?? undefined,
      },
      orderBy: [{ createdAt: "desc" }],
      take: Math.max(1, Math.min(input?.limit ?? 100, 500)),
      include: {
        employee: { select: employeeRequestSelect },
      },
    });

    return { success: true, data: rows.map((row) => serializeEmployeeLeaveCreditLedger({
      ...row,
      amount: row.amount,
      balanceBefore: row.balanceBefore,
      balanceAfter: row.balanceAfter,
    })) };
  } catch (error) {
    console.error("Error listing employee leave credit ledger:", error);
    return { success: false, error: "Failed to load leave credit history." };
  }
}
