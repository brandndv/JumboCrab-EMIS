// Backfill punch.attendanceId and recompute attendance aggregates.
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});
const minutesBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / 60000);

async function linkPunchesToAttendance() {
  await prisma.$executeRawUnsafe(`
    UPDATE "Punch" p
    SET "attendanceId" = a.id
    FROM "Attendance" a
    WHERE p."attendanceId" IS NULL
      AND p."employeeId" = a."employeeId"
      AND p."punchTime" >= a."workDate"
      AND p."punchTime" < a."workDate" + INTERVAL '1 day'
  `);
}

async function recomputeForLinked() {
  const linked = await prisma.punch.findMany({
    where: { attendanceId: { not: null } },
    select: { attendanceId: true },
  });
  const ids = Array.from(new Set(linked.map((r) => r.attendanceId)));
  if (!ids.length) return;

  const attendanceRows = await prisma.attendance.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      employeeId: true,
      workDate: true,
      scheduledStartMinutes: true,
      scheduledEndMinutes: true,
    },
  });

  for (const att of attendanceRows) {
    const dayStart = new Date(att.workDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const punches = await prisma.punch.findMany({
      where: {
        employeeId: att.employeeId,
        punchTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { punchTime: "asc" },
    });

    const firstClockIn = punches.find((p) => p.punchType === "TIME_IN") ?? null;
    const lastClockOut = [...punches].reverse().find((p) => p.punchType === "TIME_OUT") ?? null;

    const actualInAt = firstClockIn?.punchTime ?? punches[0]?.punchTime ?? null;
    const actualOutAt = lastClockOut?.punchTime ?? null;

    let breakStart = null;
    let breakMinutes = 0;
    let breakCount = 0;
    punches.forEach((p) => {
      if (p.punchType === "BREAK_IN" || p.punchType === "BREAK_OUT") {
        if (!breakStart) {
          breakStart = p.punchTime;
        } else {
          breakCount += 1;
          breakMinutes += Math.max(0, minutesBetween(breakStart, p.punchTime));
          breakStart = null;
        }
      }
    });

    const actualInMinutes = actualInAt ? minutesBetween(dayStart, actualInAt) : null;
    const actualOutMinutes = actualOutAt ? minutesBetween(dayStart, actualOutAt) : null;

    const workedMinutes =
      actualInAt && actualOutAt ? Math.max(0, minutesBetween(actualInAt, actualOutAt)) : null;

    const lateMinutes =
      att.scheduledStartMinutes != null && actualInMinutes != null
        ? Math.max(0, actualInMinutes - att.scheduledStartMinutes)
        : 0;

    const undertimeMinutes =
      att.scheduledEndMinutes != null && actualOutMinutes != null
        ? Math.max(0, att.scheduledEndMinutes - actualOutMinutes)
        : 0;

    const overtimeMinutesRaw =
      att.scheduledEndMinutes != null && actualOutMinutes != null
        ? Math.max(0, actualOutMinutes - att.scheduledEndMinutes)
        : 0;

    let status = "ABSENT";
    if (actualInAt || actualOutAt) {
      status = lateMinutes > 0 ? "LATE" : "PRESENT";
    }

    await prisma.attendance.update({
      where: { id: att.id },
      data: {
        status,
        actualInAt,
        actualOutAt,
        workedMinutes,
        breakMinutes,
        breakCount,
        lateMinutes,
        undertimeMinutes,
        overtimeMinutesRaw,
      },
    });
  }
}

async function main() {
  await linkPunchesToAttendance();
  await recomputeForLinked();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
// Force binary engine for standalone backfill script.
process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
