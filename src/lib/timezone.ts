export const TZ = "Asia/Manila";
// Manila is UTC+8.
// Offsets are handled in minutes, so 8 hours * 60 minutes = 480.
// Using minutes keeps arithmetic straightforward when shifting timestamps.
export const TZ_OFFSET_MINUTES = 8 * 60;
// DST = Daylight Saving Time (clocks move forward/back seasonally).
// The Philippines does not currently observe DST, so UTC+8 stays constant year-round.

const toTzStartMs = (date: Date) => {
  // Convert input timestamp into "Manila wall clock" milliseconds by adding offset.
  const utcMs = date.getTime();
  const tzMs = utcMs + TZ_OFFSET_MINUTES * 60 * 1000;
  const tzDate = new Date(tzMs);
  // Build midnight (00:00:00) of that Manila calendar date in UTC space.
  const startTzMs = Date.UTC(tzDate.getUTCFullYear(), tzDate.getUTCMonth(), tzDate.getUTCDate(), 0, 0, 0);
  // Shift back by the same offset so result is the true UTC timestamp for Manila midnight.
  return startTzMs - TZ_OFFSET_MINUTES * 60 * 1000;
};

export const zonedNow = () => new Date();

export const startOfZonedDay = (date: Date) => new Date(toTzStartMs(date));

export const endOfZonedDay = (date: Date) => {
  const start = startOfZonedDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
};

// Format a Date/ISO string as a time in the app timezone.
// Returns an em dash when value is missing.
// `opts` can override defaults (for example, hide seconds).
export const formatZonedTime = (value?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!value) return "—";
  // Normalize input so callers can pass either Date objects or ISO strings.
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("en-US", {
    // Force display in Manila time regardless of device/browser locale timezone.
    timeZone: TZ,
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...opts,
  });
};

// Format a Date/ISO string as a full date in the app timezone.
export const formatZonedDate = (value?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...opts,
  });
};
