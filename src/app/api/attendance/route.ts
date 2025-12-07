import { NextResponse } from "next/server";
import { ATTENDANCE_STATUS } from "@prisma/client";
import { db } from "@/lib/db";
import { getExpectedShiftForDate } from "@/lib/attendance";
import { startOfZonedDay, endOfZonedDay } from "@/lib/timezone";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");
    const includeAll = searchParams.get("includeAll") === "true";
    const singleDay = start && end && start === end;

    const where: any = {};

    if (start || end) {
      where.workDate = {};
      if (start) where.workDate.gte = startOfZonedDay(new Date(start));
      if (end) where.workDate.lt = endOfZonedDay(new Date(end));
    }

    if (employeeId) where.employeeId = employeeId;
    if (status && Object.values(ATTENDANCE_STATUS).includes(status as ATTENDANCE_STATUS)) {
      where.status = status as ATTENDANCE_STATUS;
    }

    const records = await db.attendance.findMany({
      where,
      orderBy: { workDate: "desc" },
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
        expectedShift: { select: { name: true } },
      },
    });
    const enriched = await Promise.all(
      records.map(async (r) => {
        const localDisplay = new Date(
          new Date(r.workDate).toLocaleString("en-US", { timeZone: "Asia/Manila" })
        );
        localDisplay.setHours(0, 0, 0, 0);
        const dayStart = startOfZonedDay(localDisplay);
        const dayEnd = endOfZonedDay(localDisplay);

        const punches = await db.punch.findMany({
          where: { employeeId: r.employeeId, punchTime: { gte: dayStart, lt: dayEnd } },
          orderBy: { punchTime: "asc" },
        });
        let breakCount = 0;
        let breakMinutes = 0;
        let breakStart: Date | null = null;
        punches.forEach((p) => {
          if (p.punchType === "BREAK_OUT" || p.punchType === "BREAK_IN") {
            if (!breakStart) {
              breakStart = p.punchTime;
            } else {
              breakCount += 1;
              breakMinutes += Math.max(0, Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000));
              breakStart = null;
            }
          }
        });

        const expected = await getExpectedShiftForDate(r.employeeId, dayStart);
        const expectedStart = expected.scheduledStartMinutes ?? null;
        const expectedEnd = expected.scheduledEndMinutes ?? null;

        const firstClockIn = punches.find((p) => p.punchType === "TIME_IN") ?? null;
        const lastClockOut =
          [...punches].reverse().find((p) => p.punchType === "TIME_OUT") ?? null;

        const actualInAt = firstClockIn?.punchTime ?? (r.actualInAt ? new Date(r.actualInAt) : null);
        const actualOutAt = lastClockOut?.punchTime ?? null;
        const actualInMinutes = actualInAt ? Math.round((actualInAt.getTime() - dayStart.getTime()) / 60000) : null;
        const actualOutMinutes = actualOutAt ? Math.round((actualOutAt.getTime() - dayStart.getTime()) / 60000) : null;

        const lateMinutes =
          expectedStart != null && actualInMinutes != null
            ? Math.max(0, actualInMinutes - expectedStart)
            : r.lateMinutes ?? null;
        const undertimeMinutes =
          expectedEnd != null && actualOutMinutes != null
            ? Math.max(0, expectedEnd - actualOutMinutes)
            : null;
        const overtimeMinutesRaw =
          expectedEnd != null && actualOutMinutes != null
            ? Math.max(0, actualOutMinutes - expectedEnd)
            : null;
        const workedMinutes =
          actualInAt && actualOutAt
            ? Math.max(0, Math.round((actualOutAt.getTime() - actualInAt.getTime()) / 60000))
            : null;

        return {
          ...r,
          breakCount: breakCount || r.breakCount || 0,
          breakMinutes: breakMinutes || r.breakMinutes || 0,
          actualInAt,
          actualOutAt,
          expectedShiftId: expected.shift?.id ?? r.expectedShiftId ?? null,
          expectedShiftName: expected.shift?.name ?? r.expectedShift?.name ?? null,
          scheduledStartMinutes: expectedStart,
          scheduledEndMinutes: expectedEnd,
          punchesCount: punches.length,
          lateMinutes,
          undertimeMinutes,
          overtimeMinutesRaw,
          workedMinutes,
        };
      })
    );

    // If includeAll is true and querying a single day, merge with employees so everyone appears.
    if (includeAll && singleDay) {
      const employees = await db.employee.findMany({
        where: { isArchived: false },
        orderBy: { employeeCode: "asc" },
        select: {
          employeeId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      });

      const dayStart = startOfZonedDay(new Date(start));
      const dayEnd = endOfZonedDay(new Date(start));

      const employeeIds = employees.map((e) => e.employeeId);
      const punches = await db.punch.findMany({
        where: { employeeId: { in: employeeIds }, punchTime: { gte: dayStart, lt: dayEnd } },
        orderBy: { punchTime: "asc" },
      });
      const breakMap = new Map<string, { count: number; minutes: number }>();
      for (const empId of employeeIds) breakMap.set(empId, { count: 0, minutes: 0 });
      const groupedPunches = new Map<string, typeof punches>();
      punches.forEach((p) => {
        if (!groupedPunches.has(p.employeeId)) groupedPunches.set(p.employeeId, []);
        groupedPunches.get(p.employeeId)!.push(p);
      });

      groupedPunches.forEach((list, empId) => {
        let breakStart: Date | null = null;
        let count = 0;
        let minutes = 0;
        list.forEach((p) => {
          if (p.punchType === "BREAK_OUT" || p.punchType === "BREAK_IN") {
            if (!breakStart) {
              breakStart = p.punchTime;
            } else {
              count += 1;
              minutes += Math.max(
                0,
                Math.round((p.punchTime.getTime() - breakStart.getTime()) / 60000)
              );
              breakStart = null;
            }
          }
        });
        breakMap.set(empId, { count, minutes });
      });

      const map = new Map(enriched.map((r) => [r.employeeId, r]));
      const expectedMap = new Map<string, Awaited<ReturnType<typeof getExpectedShiftForDate>>>();
      await Promise.all(
        employees.map(async (emp) => {
          const exp = await getExpectedShiftForDate(emp.employeeId, dayStart);
          expectedMap.set(emp.employeeId, exp);
        })
      );

      const merged = employees.map((emp) => {
        const existing = map.get(emp.employeeId);
        const breaks = breakMap.get(emp.employeeId) ?? { count: 0, minutes: 0 };
        const expected = expectedMap.get(emp.employeeId);
        const scheduledStart = existing?.scheduledStartMinutes ?? expected?.scheduledStartMinutes ?? null;
        const scheduledEnd = existing?.scheduledEndMinutes ?? expected?.scheduledEndMinutes ?? null;
        const expectedShiftId = existing?.expectedShiftId ?? expected?.shift?.id ?? null;
        const expectedShiftName = (existing as any)?.expectedShiftName ?? expected?.shift?.name ?? null;

        if (existing) {
          return {
            ...existing,
            scheduledStartMinutes: scheduledStart,
            scheduledEndMinutes: scheduledEnd,
            expectedShiftId,
            expectedShiftName,
            breakCount: breaks.count || existing.breakCount || 0,
            breakMinutes: breaks.minutes || existing.breakMinutes || 0,
          };
        }
        return {
          id: `placeholder-${emp.employeeId}-${start}`,
          workDate: dayStart,
          status: "ABSENT",
          expectedShiftId,
          expectedShiftName,
          scheduledStartMinutes: scheduledStart,
          scheduledEndMinutes: scheduledEnd,
          actualInAt: null,
          actualOutAt: null,
          workedMinutes: null,
          lateMinutes: null,
          undertimeMinutes: null,
          overtimeMinutesRaw: null,
          punchesCount: 0,
          breakCount: breaks.count,
          breakMinutes: breaks.minutes,
          employeeId: emp.employeeId,
          employee: emp,
        };
      });
      return NextResponse.json({ success: true, data: merged });
    }

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Failed to fetch attendance", error);
    return NextResponse.json(
      { success: false, error: "Failed to load attendance" },
      { status: 500 }
    );
  }
}
