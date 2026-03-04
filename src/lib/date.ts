export const DEFAULT_TIME_ZONE = "America/Chicago";

export function toLocalDateString(
  date = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
