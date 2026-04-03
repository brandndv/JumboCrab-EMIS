"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  FIXED_STRIKE_POINTS_PER_VIOLATION,
  canManageViolationDefinitions,
  hasViolationMaxStrikeColumn,
  normalizeMaxStrikesPerEmployee,
  toViolationDefinitionOption,
} from "./violations-shared";
import type { ViolationDefinitionOption } from "./types";

export async function createViolationDefinition(input: {
  name: string;
  description?: string | null;
  maxStrikesPerEmployee?: number | null;
  isActive?: boolean | null;
}): Promise<{
  success: boolean;
  data?: ViolationDefinitionOption;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationDefinitions(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create violation definitions.",
      };
    }

    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    const maxStrikesPerEmployee = normalizeMaxStrikesPerEmployee(
      input.maxStrikesPerEmployee,
    );
    const isActive =
      typeof input.isActive === "boolean" ? input.isActive : true;
    const hasMaxColumn = await hasViolationMaxStrikeColumn();

    if (!name) {
      return { success: false, error: "Name is required" };
    }

    const duplicate = await db.violation.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { violationId: true },
    });
    if (duplicate) {
      return { success: false, error: "Violation name already exists" };
    }

    if (hasMaxColumn) {
      const created = await db.violation.create({
        data: {
          name,
          description,
          defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
          maxStrikesPerEmployee,
          isActive,
        },
        select: {
          violationId: true,
          name: true,
          description: true,
          maxStrikesPerEmployee: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return {
        success: true,
        data: toViolationDefinitionOption(created),
      };
    }

    const created = await db.violation.create({
      data: {
        name,
        description,
        defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
        isActive,
      },
      select: {
        violationId: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      success: true,
      data: toViolationDefinitionOption(created),
    };
  } catch (error) {
    console.error("Error creating violation definition:", error);
    return { success: false, error: "Failed to create violation definition." };
  }
}

export async function updateViolationDefinition(input: {
  violationId: string;
  name: string;
  description?: string | null;
  maxStrikesPerEmployee?: number | null;
  isActive?: boolean | null;
}): Promise<{
  success: boolean;
  data?: ViolationDefinitionOption;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageViolationDefinitions(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update violation definitions.",
      };
    }

    const violationId =
      typeof input.violationId === "string" ? input.violationId.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    const maxStrikesPerEmployee = normalizeMaxStrikesPerEmployee(
      input.maxStrikesPerEmployee,
    );
    const isActive =
      typeof input.isActive === "boolean" ? input.isActive : true;
    const hasMaxColumn = await hasViolationMaxStrikeColumn();

    if (!violationId) {
      return { success: false, error: "Violation ID is required" };
    }
    if (!name) {
      return { success: false, error: "Name is required" };
    }

    const existing = await db.violation.findUnique({
      where: { violationId },
      select: { violationId: true },
    });
    if (!existing) {
      return { success: false, error: "Violation not found" };
    }

    const duplicate = await db.violation.findFirst({
      where: {
        violationId: { not: violationId },
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { violationId: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "Another violation already uses this name",
      };
    }

    if (hasMaxColumn) {
      const updated = await db.violation.update({
        where: { violationId },
        data: {
          name,
          description,
          defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
          maxStrikesPerEmployee,
          isActive,
        },
        select: {
          violationId: true,
          name: true,
          description: true,
          maxStrikesPerEmployee: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return {
        success: true,
        data: toViolationDefinitionOption(updated),
      };
    }

    const updated = await db.violation.update({
      where: { violationId },
      data: {
        name,
        description,
        defaultStrikePoints: FIXED_STRIKE_POINTS_PER_VIOLATION,
        isActive,
      },
      select: {
        violationId: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      success: true,
      data: toViolationDefinitionOption(updated),
    };
  } catch (error) {
    console.error("Error updating violation definition:", error);
    return { success: false, error: "Failed to update violation definition." };
  }
}
