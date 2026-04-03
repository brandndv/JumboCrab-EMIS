"use server";

import {
  deleteUser as deleteUserImpl,
  updateUser as updateUserImpl,
} from "./users-mutation-action";
import {
  getUserById as getUserByIdImpl,
  getUsers as getUsersImpl,
  getUsersWithEmployeeAccount as getUsersWithEmployeeAccountImpl,
} from "./users-query-action";

export async function getUsers(...args: Parameters<typeof getUsersImpl>) {
  return getUsersImpl(...args);
}

export async function getUserById(...args: Parameters<typeof getUserByIdImpl>) {
  return getUserByIdImpl(...args);
}

export async function updateUser(...args: Parameters<typeof updateUserImpl>) {
  return updateUserImpl(...args);
}

export async function deleteUser(...args: Parameters<typeof deleteUserImpl>) {
  return deleteUserImpl(...args);
}

export async function getUsersWithEmployeeAccount(
  ...args: Parameters<typeof getUsersWithEmployeeAccountImpl>
) {
  return getUsersWithEmployeeAccountImpl(...args);
}
