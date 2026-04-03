"use server";

import {
  archivePosition as archivePositionImpl,
  createPosition as createPositionImpl,
  deletePosition as deletePositionImpl,
  unarchivePosition as unarchivePositionImpl,
  updatePosition as updatePositionImpl,
} from "./positions-mutation-action";
import { listPositions as listPositionsImpl } from "./positions-query-action";

export async function listPositions(
  ...args: Parameters<typeof listPositionsImpl>
) {
  return listPositionsImpl(...args);
}

export async function createPosition(
  ...args: Parameters<typeof createPositionImpl>
) {
  return createPositionImpl(...args);
}

export async function updatePosition(
  ...args: Parameters<typeof updatePositionImpl>
) {
  return updatePositionImpl(...args);
}

export async function archivePosition(
  ...args: Parameters<typeof archivePositionImpl>
) {
  return archivePositionImpl(...args);
}

export async function unarchivePosition(
  ...args: Parameters<typeof unarchivePositionImpl>
) {
  return unarchivePositionImpl(...args);
}

export async function deletePosition(
  ...args: Parameters<typeof deletePositionImpl>
) {
  return deletePositionImpl(...args);
}

export type { PositionDetail } from "./positions-shared";
