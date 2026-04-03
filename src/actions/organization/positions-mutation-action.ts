"use server";

import { db } from "@/lib/db";
import {
  getPositionBaseName,
  isArchivedTokenName,
  resolvePositionRestoreName,
} from "./positions-shared";

export async function createPosition(input: {
  name: string;
  description?: string | null;
  departmentId: string;
}): Promise<{
  success: boolean;
  data?: {
    positionId: string;
    name: string;
    description?: string | null;
    departmentId: string;
    department?: { departmentId: string; name: string };
  };
  error?: string;
}> {
  try {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : null;
    const departmentId =
      typeof input.departmentId === "string"
        ? input.departmentId.trim()
        : "";

    if (!name) {
      return { success: false, error: "Name is required" };
    }
    if (!departmentId) {
      return { success: false, error: "Department is required" };
    }

    const department = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!department) {
      return { success: false, error: "Department not found" };
    }

    const existing = await db.position.findFirst({
      where: { name, departmentId, isActive: true },
      select: { positionId: true },
    });
    if (existing) {
      return {
        success: false,
        error: "Position already exists in this department",
      };
    }

    const position = await db.position.create({
      data: { name, description, departmentId },
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
      },
    });

    return { success: true, data: position };
  } catch (error) {
    console.error("Failed to create position", error);
    return { success: false, error: "Failed to create position" };
  }
}

export async function updatePosition(input: {
  positionId: string;
  name: string;
  description?: string | null;
  departmentId: string;
}): Promise<{
  success: boolean;
  data?: {
    positionId: string;
    name: string;
    description?: string | null;
    departmentId: string;
    department?: { departmentId: string; name: string };
  };
  error?: string;
}> {
  try {
    const positionId =
      typeof input.positionId === "string" ? input.positionId.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description =
      typeof input.description === "string" ? input.description.trim() : null;
    const departmentId =
      typeof input.departmentId === "string"
        ? input.departmentId.trim()
        : "";

    if (!positionId) {
      return { success: false, error: "Position ID is required" };
    }
    if (!name) {
      return { success: false, error: "Name is required" };
    }
    if (!departmentId) {
      return { success: false, error: "Department is required" };
    }

    const position = await db.position.findUnique({
      where: { positionId },
      select: { positionId: true },
    });
    if (!position) {
      return { success: false, error: "Position not found" };
    }

    const department = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!department) {
      return { success: false, error: "Department not found" };
    }

    const conflict = await db.position.findFirst({
      where: {
        positionId: { not: positionId },
        name,
        departmentId,
        isActive: true,
      },
      select: { positionId: true },
    });
    if (conflict) {
      return {
        success: false,
        error: "Another position in this department uses this name",
      };
    }

    const updated = await db.position.update({
      where: { positionId },
      data: { name, description, departmentId },
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
      },
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error("Failed to update position", error);
    return { success: false, error: "Failed to update position" };
  }
}

export async function archivePosition(positionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const id = typeof positionId === "string" ? positionId.trim() : "";
    if (!id) {
      return { success: false, error: "Position ID is required" };
    }

    const existing = await db.position.findUnique({
      where: { positionId: id },
      select: { positionId: true, name: true },
    });
    if (!existing) {
      return { success: false, error: "Position not found" };
    }

    if (isArchivedTokenName(existing.name)) {
      await db.position.update({
        where: { positionId: id },
        data: { isActive: false },
      });
      return { success: true };
    }

    await db.position.update({
      where: { positionId: id },
      data: {
        isActive: false,
        name: `${existing.name}__archived__${existing.positionId}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to archive position", error);
    return { success: false, error: "Failed to archive position" };
  }
}

export async function unarchivePosition(positionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const id = typeof positionId === "string" ? positionId.trim() : "";
    if (!id) {
      return { success: false, error: "Position ID is required" };
    }

    const existing = await db.position.findUnique({
      where: { positionId: id },
      select: {
        positionId: true,
        name: true,
        isActive: true,
        departmentId: true,
        department: {
          select: { departmentId: true, isActive: true },
        },
      },
    });
    if (!existing) {
      return { success: false, error: "Position not found" };
    }
    if (existing.isActive) {
      return { success: true };
    }
    if (!existing.department?.isActive) {
      return {
        success: false,
        error: "Unarchive the department first before restoring this position",
      };
    }

    const restoredName = await resolvePositionRestoreName(
      id,
      existing.departmentId,
      getPositionBaseName(existing.name),
    );

    await db.position.update({
      where: { positionId: id },
      data: {
        isActive: true,
        name: restoredName,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to unarchive position", error);
    return { success: false, error: "Failed to unarchive position" };
  }
}

export async function deletePosition(positionId: string) {
  return archivePosition(positionId);
}
