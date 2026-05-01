import "server-only";

import { db } from "@/lib/db";
import { serializeAttendance, serializePunch } from "@/actions/attendance/attendance-shared";
import { publishAttendanceLiveEvent } from "./bus.server";

export async function publishAttendanceUpdate(input: {
  employeeId: string;
  workDate: Date;
  punchId?: string | null;
  deletedPunchId?: string | null;
}) {
  const attendance = await db.attendance.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: input.employeeId,
        workDate: input.workDate,
      },
    },
    include: {
      employee: {
        select: {
          employeeId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
      expectedShift: {
        select: {
          id: true,
          name: true,
          startMinutes: true,
          endMinutes: true,
          breakStartMinutes: true,
          breakEndMinutes: true,
          breakMinutesUnpaid: true,
          paidHoursPerDay: true,
        },
      },
    },
  });

  const punch = input.punchId
    ? await db.punch.findUnique({
        where: { id: input.punchId },
        include: {
          employee: {
            select: {
              employeeId: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
      })
    : null;

  await publishAttendanceLiveEvent({
    employeeId: input.employeeId,
    workDate: input.workDate.toISOString(),
    attendance: attendance
      ? serializeAttendance(attendance, {
          punchesCount: await db.punch.count({
            where: {
              employeeId: input.employeeId,
              punchTime: {
                gte: input.workDate,
                lt: new Date(input.workDate.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          }),
        })
      : null,
    punch: punch ? serializePunch(punch) : null,
    deletedPunchId: input.deletedPunchId ?? null,
    publishedAt: new Date().toISOString(),
  });
}
