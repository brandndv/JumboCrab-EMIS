export const isKioskPunchIpAllowed = (ip: string | null) => {
  const raw = process.env.ALLOWED_PUNCH_IPS;
  if (!raw) return true;
  const list = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!list.length) return true;
  return Boolean(ip && list.includes(ip));
};

export const serializeKioskPunch = (punch: {
  punchTime: Date;
  punchType: string;
}) => ({
  punchTime: punch.punchTime.toISOString(),
  punchType: punch.punchType,
});

export const serializeKioskPunchNullable = (
  punch: { punchTime: Date; punchType: string } | null,
) => (punch ? serializeKioskPunch(punch) : null);

export const computeKioskBreakStats = (
  punches: Array<{ punchTime: Date; punchType: string }>,
) => {
  let breakCount = 0;
  let breakMinutes = 0;
  let breakStart: Date | null = null;

  punches.forEach((punch) => {
    if (punch.punchType === "BREAK_OUT" || punch.punchType === "BREAK_IN") {
      if (!breakStart) {
        breakStart = punch.punchTime;
      } else {
        breakCount += 1;
        breakMinutes += Math.max(
          0,
          Math.round((punch.punchTime.getTime() - breakStart.getTime()) / 60000),
        );
        breakStart = null;
      }
    }
  });

  return { breakCount, breakMinutes };
};
