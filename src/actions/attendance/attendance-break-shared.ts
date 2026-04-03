export const computeBreakStats = (
  punches: Array<{ punchType: string; punchTime: Date }>,
): {
  breakCount: number;
  breakMinutes: number;
  breakStartAt: Date | null;
  breakEndAt: Date | null;
} => {
  let breakCount = 0;
  let breakMinutes = 0;
  let breakStart: Date | null = null;
  let breakStartAt: Date | null = null;
  let breakEndAt: Date | null = null;

  punches.forEach((punch) => {
    if (punch.punchType === "BREAK_OUT" || punch.punchType === "BREAK_IN") {
      if (!breakStart) {
        breakStart = punch.punchTime;
        if (!breakStartAt) breakStartAt = punch.punchTime;
      } else {
        breakCount += 1;
        breakMinutes += Math.max(
          0,
          Math.round((punch.punchTime.getTime() - breakStart.getTime()) / 60000),
        );
        breakEndAt = punch.punchTime;
        breakStart = null;
      }
    }
  });

  return { breakCount, breakMinutes, breakStartAt, breakEndAt };
};
