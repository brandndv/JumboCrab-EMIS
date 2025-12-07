import { NextResponse } from "next/server";
import { ATTENDANCE_STATUS } from "@prisma/client";
import { db } from "@/lib/db";
import { startOfZonedDay, endOfZonedDay, TZ } from "@/lib/timezone";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const dateRaw = typeof body?.date === "string" ? body.date : null;
    const targetDate = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date" },
        { status: 400 }
      );
    }

    // Use the day in the configured TZ.
    const dayStart = startOfZonedDay(targetDate);
    const dayEnd = endOfZonedDay(targetDate);
    const now = new Date();

    const candidates = await db.attendance.findMany({
      where: {
        workDate: { gte: dayStart, lt: dayEnd },
        isLocked: false,
      },
    });

    let lockedCount = 0;
    for (const att of candidates) {
      let status = att.status;
      // If no time out, mark as incomplete; otherwise keep the existing status.
      if (!att.actualOutAt) status = ATTENDANCE_STATUS.INCOMPLETE;

      await db.attendance.update({
        where: { id: att.id },
        data: {
          isLocked: true,
          status,
        },
      });
      lockedCount += 1;
    }

    return NextResponse.json({ success: true, lockedCount, date: dayStart.toISOString(), tz: TZ });
  } catch (error) {
    console.error("Failed to auto-lock attendance", error);
    return NextResponse.json(
      { success: false, error: "Failed to auto-lock attendance" },
      { status: 500 }
    );
  }
}
