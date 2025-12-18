/**
 * Format a Date to YYYY-MM-DD string for the API
 * @param date - The Date object to format, or undefined
 * @returns The formatted date string in YYYY-MM-DD format, or undefined if date is not provided
 */
export function formatDateForApi(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString().split("T")[0];
}
