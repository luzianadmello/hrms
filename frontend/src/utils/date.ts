// All dates are shown as dd/mm/yyyy. The API and the database keep
// yyyy-mm-dd, so sorting and <input type="date"> keep working.

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-27" or "2026-10-27T10:46:21+05:30" -> "27/10/2026". */
export function formatDate(
  value: string | null | undefined,
  fallback = "",
): string {
  if (!value) return fallback;

  // Plain date: reorder the text, so no timezone can shift the day.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) return `${plain[3]}/${plain[2]}/${plain[1]}`;

  // Date with a time: show the day it falls on in India.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

/** "2026-10-27T05:16:21Z" -> "27/10/2026 10:46" (India time, 24-hour). */
export function formatDateTime(
  value: string | null | undefined,
  fallback = "",
): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${pad(Number(get("hour")))}:${get("minute")}`;
}