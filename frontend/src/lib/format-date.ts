const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-09-18" -> "18-Sep-2026". Formatted by hand from the ISO date (or the
// date part of an ISO timestamp) so it doesn't depend on the browser locale,
// or shift a day by parsing a date-only string as UTC.
export function formatDayMonYear(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}-${MONTHS[Number(month) - 1] ?? month}-${year}`;
}
