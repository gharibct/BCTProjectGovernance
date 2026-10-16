// Projects Count is stored as a whole number (the API rejects 8.5), so the
// screens check it before saving. Blank is allowed.
export const PROJECTS_COUNT_ERROR = "Projects Count must be a whole number.";

export function isWholeNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || /^\d+$/.test(trimmed);
}
