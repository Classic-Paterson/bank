/**
 * Validation and parsing utilities for CLI commands.
 * Centralizes date and amount handling to ensure consistent validation and error messages.
 */

/**
 * Date parsing result - either success with a Date, or failure with error message
 */
export type DateParseResult =
  | { success: true; date: Date }
  | { success: false; error: string };

/**
 * Date range validation result
 */
export type DateRangeResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Try to parse a natural date shortcut like "today", "yesterday", or "7d".
 * Returns null if the input doesn't match any known shortcut.
 *
 * Supported shortcuts:
 * - "today" - current date
 * - "yesterday" - one day ago
 * - "Nd" or "Ndays" - N days ago (e.g., "7d", "30days")
 * - "N days ago" - N days ago (e.g., "7 days ago", "30 days ago")
 * - "Nw" or "Nweeks" - N weeks ago (e.g., "2w", "4weeks")
 * - "N weeks ago" - N weeks ago (e.g., "2 weeks ago", "4 weeks ago")
 * - "Nm" or "Nmonths" - N months ago (e.g., "1m", "3months")
 * - "N months ago" - N months ago (e.g., "3 months ago", "6 months ago")
 * - "thisweek" - first day of current week (Monday)
 * - "lastweek" - first day of previous week (Monday)
 * - "thismonth" - first day of current month
 * - "lastmonth" - first day of previous month
 * - "endoflastmonth" - last day of previous month
 * - "endofthismonth" - last day of current month
 * - "endoflastweek" - last day (Sunday) of previous week
 * - "endofthisweek" - last day (Sunday) of current week
 * - "thisquarter" - first day of current quarter
 * - "lastquarter" - first day of previous quarter
 * - "endofthisquarter" - last day of current quarter
 * - "endoflastquarter" - last day of previous quarter
 * - "thisyear" - first day of current year
 * - "lastyear" - first day of previous year
 * - "endofthisyear" - last day of current year (Dec 31)
 * - "endoflastyear" - last day of previous year (Dec 31)
 *
 * @param dateStr - The date string to try parsing
 * @returns Date if matched, null otherwise
 */
function tryParseDateShortcut(dateStr: string): Date | null {
  const normalized = dateStr.toLowerCase().trim();

  if (normalized === 'today') {
    return new Date();
  }

  if (normalized === 'yesterday') {
    return daysAgo(1);
  }

  // "thisweek" - first day of current week (Monday)
  if (normalized === 'thisweek') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Sunday is 0, Monday is 1, etc. We want Monday as start of week.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
  }

  // "lastweek" - first day of previous week (Monday)
  if (normalized === 'lastweek') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract - 7);
  }

  // "thismonth" - first day of current month
  if (normalized === 'thismonth') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // "lastmonth" - first day of previous month
  if (normalized === 'lastmonth') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  // "endoflastmonth" - last day of previous month (useful for --until)
  if (normalized === 'endoflastmonth') {
    const now = new Date();
    // Day 0 of current month = last day of previous month
    return new Date(now.getFullYear(), now.getMonth(), 0);
  }

  // "endofthismonth" - last day of current month (useful for --until)
  if (normalized === 'endofthismonth') {
    const now = new Date();
    // Day 0 of next month = last day of current month
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // "endoflastweek" - last day (Sunday) of previous week
  if (normalized === 'endoflastweek') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Sunday is 0, so last Sunday is (dayOfWeek) days ago,
    // but we want the Sunday before that if today is Sunday
    const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastSunday);
  }

  // "endofthisweek" - last day (Sunday) of current week
  if (normalized === 'endofthisweek') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Sunday is 0. We want the upcoming Sunday (or today if it's Sunday)
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday);
  }

  // "thisquarter" - first day of current quarter
  if (normalized === 'thisquarter') {
    const now = new Date();
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterStartMonth, 1);
  }

  // "lastquarter" - first day of previous quarter
  if (normalized === 'lastquarter') {
    const now = new Date();
    const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const lastQuarterStartMonth = currentQuarterStartMonth - 3;
    const year = lastQuarterStartMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = lastQuarterStartMonth < 0 ? lastQuarterStartMonth + 12 : lastQuarterStartMonth;
    return new Date(year, month, 1);
  }

  // "endofthisquarter" - last day of current quarter
  if (normalized === 'endofthisquarter') {
    const now = new Date();
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    // Last day of quarter = day 0 of first month of next quarter
    return new Date(now.getFullYear(), quarterStartMonth + 3, 0);
  }

  // "endoflastquarter" - last day of previous quarter
  if (normalized === 'endoflastquarter') {
    const now = new Date();
    const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    // Last day of previous quarter = day 0 of current quarter start month
    return new Date(now.getFullYear(), currentQuarterStartMonth, 0);
  }

  // "thisyear" - first day of current year
  if (normalized === 'thisyear') {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  }

  // "lastyear" - first day of previous year
  if (normalized === 'lastyear') {
    const now = new Date();
    return new Date(now.getFullYear() - 1, 0, 1);
  }

  // "endofthisyear" - last day of current year (Dec 31)
  if (normalized === 'endofthisyear') {
    const now = new Date();
    return new Date(now.getFullYear(), 11, 31);
  }

  // "endoflastyear" - last day of previous year (Dec 31)
  if (normalized === 'endoflastyear') {
    const now = new Date();
    return new Date(now.getFullYear() - 1, 11, 31);
  }

  // Match "Nd" or "Ndays" pattern (e.g., "7d", "30days", "7 days")
  const daysMatch = normalized.match(/^(\d+)\s*d(?:ays?)?$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days >= 0 && days <= 36500) { // Cap at ~100 years
      return daysAgo(days);
    }
  }

  // Match "N days ago" pattern (e.g., "7 days ago", "30 days ago")
  const daysAgoMatch = normalized.match(/^(\d+)\s*days?\s+ago$/);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    if (days >= 0 && days <= 36500) {
      return daysAgo(days);
    }
  }

  // Match "Nw" or "Nweeks" pattern (e.g., "2w", "4weeks", "2 weeks")
  const weeksMatch = normalized.match(/^(\d+)\s*w(?:eeks?)?$/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    if (weeks >= 0 && weeks <= 5200) { // Cap at ~100 years
      return daysAgo(weeks * 7);
    }
  }

  // Match "N weeks ago" pattern (e.g., "2 weeks ago", "4 weeks ago")
  const weeksAgoMatch = normalized.match(/^(\d+)\s*weeks?\s+ago$/);
  if (weeksAgoMatch) {
    const weeks = parseInt(weeksAgoMatch[1], 10);
    if (weeks >= 0 && weeks <= 5200) {
      return daysAgo(weeks * 7);
    }
  }

  // Match "Nm" or "Nmonths" pattern (e.g., "1m", "3months", "6 months")
  const monthsMatch = normalized.match(/^(\d+)\s*m(?:onths?)?$/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    if (months >= 0 && months <= 1200) { // Cap at 100 years
      return monthsAgo(months);
    }
  }

  // Match "N months ago" pattern (e.g., "3 months ago", "6 months ago")
  const monthsAgoMatch = normalized.match(/^(\d+)\s*months?\s+ago$/);
  if (monthsAgoMatch) {
    const months = parseInt(monthsAgoMatch[1], 10);
    if (months >= 0 && months <= 1200) {
      return monthsAgo(months);
    }
  }

  return null;
}

/**
 * Get a date N months ago from today.
 * Handles month rollover correctly (e.g., Jan 31 -> Oct 31 for 3 months ago,
 * but Mar 31 -> Feb 28/29 for 1 month ago).
 *
 * @param months - Number of months to go back
 * @returns Date object for N months ago
 */
export function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

/**
 * Parse and validate a date string.
 *
 * Accepts:
 * - YYYY-MM-DD format (e.g., "2024-01-15")
 * - Natural shortcuts: "today", "yesterday", "7d", "30days", "7 days ago",
 *   "2w", "4weeks", "2 weeks ago", "3m", "6months", "3 months ago",
 *   "thisweek", "lastweek", "endofthisweek", "endoflastweek",
 *   "thismonth", "lastmonth", "endofthismonth", "endoflastmonth",
 *   "thisquarter", "lastquarter", "endofthisquarter", "endoflastquarter",
 *   "thisyear", "lastyear", "endofthisyear", "endoflastyear"
 *
 * Returns a result object to allow callers to handle errors appropriately.
 *
 * @param dateStr - The date string to parse
 * @param fieldName - Name of the field for error messages (e.g., "since", "until")
 * @returns DateParseResult with either the parsed Date or an error message
 *
 * @example
 * const result = parseDate('2024-01-15', 'since');
 * const result = parseDate('yesterday', 'since');
 * const result = parseDate('7 days ago', 'since');
 * const result = parseDate('lastmonth', 'since');
 * const result = parseDate('thisquarter', 'since');
 * if (result.success) {
 *   console.log(result.date);
 * } else {
 *   throw new Error(result.error);
 * }
 */
export function parseDate(dateStr: string, fieldName: string): DateParseResult {
  // First, try natural date shortcuts
  const shortcutDate = tryParseDateShortcut(dateStr);
  if (shortcutDate) {
    return { success: true, date: shortcutDate };
  }

  // Check format matches YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      success: false,
      error: `Invalid date format for --${fieldName}: "${dateStr}". ` +
        `Expected YYYY-MM-DD or shortcuts like "today", "yesterday", "7d", "7 days ago", "2w", "2 weeks ago", "3m", "3 months ago", "thisweek", "thismonth", "thisquarter", "thisyear".`,
    };
  }

  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return {
      success: false,
      error: `Invalid date for --${fieldName}: "${dateStr}". Please provide a valid date.`,
    };
  }

  // Verify the parsed date matches the input to catch impossible dates
  // (e.g., 2024-02-30 becomes 2024-03-01, which we should reject)
  const [year, month, day] = dateStr.split('-').map(Number);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return {
      success: false,
      error: `Invalid date for --${fieldName}: "${dateStr}". Please provide a valid date.`,
    };
  }

  return { success: true, date: parsed };
}

/**
 * Validate that a date range is valid (start <= end).
 *
 * @param start - Start date
 * @param end - End date
 * @param startLabel - Label for start date in error message
 * @param endLabel - Label for end date in error message
 * @returns DateRangeResult indicating if the range is valid
 */
export function validateDateRange(
  start: Date,
  end: Date,
  startLabel: string = 'since',
  endLabel: string = 'until'
): DateRangeResult {
  if (start > end) {
    const startStr = formatDateISO(start);
    const endStr = formatDateISO(end);
    return {
      success: false,
      error: `Invalid date range: --${startLabel} (${startStr}) is after --${endLabel} (${endStr}).`,
    };
  }
  return { success: true };
}

/**
 * Format a Date object as YYYY-MM-DD string (ISO date only).
 *
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get a date N days ago from today.
 *
 * @param days - Number of days to go back
 * @returns Date object for N days ago
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Amount range validation result
 */
export type AmountRangeResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Validate amount filter values.
 * Ensures amounts are non-negative and that minAmount <= maxAmount when both are specified.
 *
 * @param minAmount - Minimum amount filter value (optional)
 * @param maxAmount - Maximum amount filter value (optional)
 * @returns AmountRangeResult indicating if the values are valid
 *
 * @example
 * const result = validateAmountRange(100, 500);
 * if (!result.success) {
 *   throw new Error(result.error);
 * }
 */
export function validateAmountRange(
  minAmount?: number,
  maxAmount?: number
): AmountRangeResult {
  if (minAmount !== undefined && minAmount < 0) {
    return {
      success: false,
      error: `Invalid --minAmount: ${minAmount}. Amount filters must be non-negative.`,
    };
  }

  if (maxAmount !== undefined && maxAmount < 0) {
    return {
      success: false,
      error: `Invalid --maxAmount: ${maxAmount}. Amount filters must be non-negative.`,
    };
  }

  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    return {
      success: false,
      error: `Invalid amount range: --minAmount (${minAmount}) is greater than --maxAmount (${maxAmount}).`,
    };
  }

  return { success: true };
}

/**
 * Options for parsing a date range from CLI flags.
 */
export interface DateRangeOptions {
  /** --since flag value (YYYY-MM-DD) */
  since?: string;
  /** --until flag value (YYYY-MM-DD) */
  until?: string;
  /** --days flag value (overrides --since) */
  days?: number;
  /** Default number of days back if neither --since nor --days provided */
  defaultDaysBack: number;
  /** If true, extend end date by one day when start and end are the same */
  extendSameDayRange?: boolean;
  /** Optional callback to warn user (e.g., when --days overrides --since) */
  onWarning?: (message: string) => void;
}

/**
 * Parsed and validated date range result.
 */
export type DateRangeParseResult =
  | { success: true; startDate: string; endDate: string; startParsed: Date; endParsed: Date }
  | { success: false; error: string };

/**
 * Parse and validate a date range from CLI flags.
 * Handles --since, --until, and --days flags with consistent validation.
 *
 * Priority: --days > --since > defaultDaysBack
 *
 * @param options - Date range options from CLI flags
 * @returns Validated date range or error message
 *
 * @example
 * const result = parseDateRange({
 *   since: flags.since,
 *   until: flags.until,
 *   days: flags.days,
 *   defaultDaysBack: 7,
 * });
 * if (!result.success) {
 *   this.error(result.error);
 * }
 * const { startDate, endDate } = result;
 */
export function parseDateRange(options: DateRangeOptions): DateRangeParseResult {
  const { since, until, days, defaultDaysBack, extendSameDayRange = false, onWarning } = options;

  // Validate --days is positive when provided
  if (days !== undefined && days < 1) {
    return {
      success: false,
      error: `Invalid --days value: ${days}. Must be at least 1.`,
    };
  }

  // Parse --until date (defaults to today)
  let endParsed: Date;
  if (until) {
    const untilResult = parseDate(until, 'until');
    if (!untilResult.success) {
      return untilResult;
    }
    endParsed = untilResult.date;
  } else {
    endParsed = new Date();
  }

  // Determine start date: --days takes precedence, then --since, then default
  let startParsed: Date;
  if (days !== undefined) {
    // Warn if --since was also provided (it will be ignored)
    if (since && onWarning) {
      onWarning(`Both --days and --since provided. Using --days=${days} (ignoring --since="${since}").`);
    }
    startParsed = daysAgo(days);
  } else if (since) {
    const sinceResult = parseDate(since, 'since');
    if (!sinceResult.success) {
      return sinceResult;
    }
    startParsed = sinceResult.date;
  } else {
    startParsed = daysAgo(defaultDaysBack);
  }

  // If start and end are the same day and extension is enabled, shift end by one day
  if (extendSameDayRange && startParsed.toDateString() === endParsed.toDateString()) {
    endParsed.setDate(endParsed.getDate() + 1);
  }

  // Validate date range ordering
  const rangeResult = validateDateRange(startParsed, endParsed);
  if (!rangeResult.success) {
    return rangeResult;
  }

  return {
    success: true,
    startDate: formatDateISO(startParsed),
    endDate: formatDateISO(endParsed),
    startParsed,
    endParsed,
  };
}
