import { ENV } from "./env";

export const DEFAULT_POST_SCHEDULER_TIME_ZONE = "America/Fortaleza";

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;

let warnedInvalidTimeZone = false;

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getPostSchedulerTimeZone() {
  const configured = ENV.postSchedulerTimeZone.trim() || DEFAULT_POST_SCHEDULER_TIME_ZONE;
  if (isValidTimeZone(configured)) return configured;

  if (!warnedInvalidTimeZone) {
    console.warn(
      `[PostScheduler] Invalid POST_SCHEDULER_TIME_ZONE "${configured}". ` +
        `Falling back to ${DEFAULT_POST_SCHEDULER_TIME_ZONE}.`
    );
    warnedInvalidTimeZone = true;
  }

  return DEFAULT_POST_SCHEDULER_TIME_ZONE;
}

function parseDateTimeLocal(value: string): LocalDateTimeParts | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second ?? 0),
  };

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    return null;
  }

  const normalized = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );

  if (
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() !== parts.month - 1 ||
    normalized.getUTCDate() !== parts.day ||
    normalized.getUTCHours() !== parts.hour ||
    normalized.getUTCMinutes() !== parts.minute ||
    normalized.getUTCSeconds() !== parts.second
  ) {
    return null;
  }

  return parts;
}

function getZonedParts(date: Date, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const byType = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const zoned = getZonedParts(date, timeZone);
  const zonedAsUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );

  return zonedAsUtcMs - date.getTime();
}

function dateTimeLocalToUtcDate(parts: LocalDateTimeParts, timeZone: string) {
  const wallTimeMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  let utcMs = wallTimeMs;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nextUtcMs = wallTimeMs - getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    if (Math.abs(nextUtcMs - utcMs) < 1) {
      utcMs = nextUtcMs;
      break;
    }
    utcMs = nextUtcMs;
  }

  return new Date(utcMs);
}

export function parsePostScheduledAt(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const localParts = parseDateTimeLocal(trimmed);
  if (localParts) {
    return dateTimeLocalToUtcDate(localParts, getPostSchedulerTimeZone());
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
