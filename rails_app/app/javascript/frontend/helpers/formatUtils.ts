/**
 * Options for formatting a date
 */
export interface FormatDateOptions {
  /** Locale string (default: "en-US") */
  locale?: string;
  /** Intl.DateTimeFormatOptions for customizing the date format */
  formatOptions?: Intl.DateTimeFormatOptions;
  /** Text to display when date is not provided (default: "Not set") */
  fallback?: string;
}

/**
 * Format a date for display with customizable options
 * @param date - The Date object to format, or undefined/null
 * @param options - Formatting options
 * @returns The formatted date string or the fallback text
 */
export function formatDate(date: Date | null | undefined, options: FormatDateOptions = {}): string {
  const {
    locale = "en-US",
    formatOptions = { month: "short", day: "numeric", year: "numeric" },
    fallback = "Not set",
  } = options;

  if (!date) return fallback;

  return date.toLocaleDateString(locale, formatOptions);
}

/**
 * Options for formatting a schedule
 */
export interface FormatScheduleOptions {
  /** Array of day names */
  days: string[];
  /** Start time string */
  startTime: string;
  /** End time string */
  endTime: string;
  /** Timezone string */
  timezone: string;
  /** Separator for joining days (default: ", ") */
  daysSeparator?: string;
  /** Text to display when no days are selected (default: "No days selected") */
  emptyDaysFallback?: string;
}

/**
 * Format a time string to 12-hour format with AM/PM
 * @param time - Time string in 24-hour format (HH:mm) or 12-hour format
 * @returns Formatted time string in 12-hour format with AM/PM (no leading zero for hours 1-9)
 */
function formatTimeTo12Hour(time: string): string {
  // If already in 12-hour format (contains AM/PM), return as-is
  if (time.includes("AM") || time.includes("PM")) {
    return time;
  }

  // Parse 24-hour format (HH:mm)
  const [hours, minutes] = time.split(":");
  const hour24 = parseInt(hours, 10);
  const mins = minutes || "00";

  if (isNaN(hour24)) {
    return time; // Return original if parsing fails
  }

  // Convert to 12-hour format
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const period = hour24 < 12 ? "AM" : "PM";
  // Don't pad with leading zero for single-digit hours (1-9)
  const formattedHour = hour12.toString();

  return `${formattedHour}:${mins} ${period}`;
}

/**
 * Format a schedule for display
 * @param options - Schedule formatting options
 * @returns Object with formatted days and timeRange strings
 * @example
 * formatSchedule({
 *   days: ["Monday", "Wednesday", "Friday"],
 *   startTime: "09:00",
 *   endTime: "17:00",
 *   timezone: "PST"
 * })
 * // Returns: { days: "Monday, Wednesday, Friday", timeRange: "09:00 AM - 5:00 PM PST" }
 */
export function formatSchedule(options: FormatScheduleOptions): {
  days: string;
  timeRange: string;
} {
  const {
    days,
    startTime,
    endTime,
    timezone,
    daysSeparator = ", ",
    emptyDaysFallback = "No days selected",
  } = options;

  const formattedDays = days.length > 0 ? days.join(daysSeparator) : emptyDaysFallback;
  const formattedStartTime = formatTimeTo12Hour(startTime);
  const formattedEndTime = formatTimeTo12Hour(endTime);
  const timeRange = `${formattedStartTime} - ${formattedEndTime} ${timezone}`;

  return { days: formattedDays, timeRange };
}

/**
 * Filter and transform items to get only selected (non-rejected) items
 * @param items - Array of items with id, text, and rejected properties, or undefined
 * @returns Array of selected items with only id and text properties
 * @example
 * getSelectedItems([
 *   { id: "1", text: "Item 1", rejected: false },
 *   { id: "2", text: "Item 2", rejected: true },
 *   { id: "3", text: "Item 3", rejected: false }
 * ])
 * // Returns: [{ id: "1", text: "Item 1" }, { id: "3", text: "Item 3" }]
 */
export function getSelectedItems<T extends { id: string; text: string; rejected: boolean }>(
  items: T[] | undefined
): Array<{ id: string; text: string }> {
  return (
    items?.filter((item) => !item.rejected).map((item) => ({ id: item.id, text: item.text })) ?? []
  );
}
