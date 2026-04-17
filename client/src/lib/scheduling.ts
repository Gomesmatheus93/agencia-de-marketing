const DEFAULT_POST_SCHEDULER_TIME_ZONE = "America/Fortaleza";
const configuredPostSchedulerTimeZone = import.meta.env.VITE_POST_SCHEDULER_TIME_ZONE;

function resolvePostSchedulerTimeZone() {
  const timeZone = configuredPostSchedulerTimeZone || DEFAULT_POST_SCHEDULER_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_POST_SCHEDULER_TIME_ZONE;
  }
}

export const POST_SCHEDULER_TIME_ZONE = resolvePostSchedulerTimeZone();

function getDatePartMap(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: POST_SCHEDULER_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function toSchedulerDatetimeLocalValue(date = new Date()) {
  const parts = getDatePartMap(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function isSchedulerDatetimeLocalInFuture(value: string, now = new Date()) {
  return value > toSchedulerDatetimeLocalValue(now);
}
