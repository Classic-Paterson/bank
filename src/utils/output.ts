/* eslint-disable camelcase */
import Table from 'cli-table3';
import { Input, stringify } from 'csv-stringify/sync';
import { TABLE_MAX_COLUMN_WIDTH, OUTPUT_FORMATS, NZD_DECIMAL_PLACES } from '../constants/index.js';

/** Type for valid output formats */
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/**
 * Check if a string is a valid output format.
 * @param format - The format string to validate
 * @returns true if valid, false otherwise
 */
export function isValidOutputFormat(format: string): format is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(format.toLowerCase());
}

/**
 * Validate and normalize an output format string.
 * Throws an error with a helpful message if the format is invalid.
 * @param format - The format string to validate
 * @returns The normalized (lowercase) format string
 * @throws Error if format is invalid
 */
export function validateOutputFormat(format: string): OutputFormat {
  const normalized = format.toLowerCase();
  if (!isValidOutputFormat(normalized)) {
    throw new Error(
      `Invalid output format: "${format}". ` +
      `Supported formats: ${OUTPUT_FORMATS.join(', ')}`
    );
  }
  return normalized as OutputFormat;
}

/**
 * Types for output formatting
 */

/** Category expense data structure from the categories command */
interface CategoryExpenseData {
  months: string[];
  expenses_by_category: Record<string, Record<string, number>>;
}

/** Type guard to check if data is category expense format */
function isCategoryExpenseData(data: unknown): data is CategoryExpenseData {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    'months' in data &&
    'expenses_by_category' in data &&
    Array.isArray((data as CategoryExpenseData).months)
  );
}

/** Base constraint for data records that can be formatted for output */
type DataRecord = object;

/**
 * Logger function type for output.
 * Allows commands to pass their own logger (e.g., this.log) for proper oclif integration.
 * Defaults to console.log for backward compatibility.
 */
export type Logger = (message: string) => void;

/**
 * Options for formatting relative time.
 */
export interface RelativeTimeOptions {
    /**
     * When true, produces shorter output suitable for tables:
     * - "today" instead of "just now"
     * - "2w ago" instead of "2 weeks ago"
     * - Falls back to date string for times older than 30 days
     */
    compact?: boolean;
}

/**
 * Format a timestamp as a human-readable relative time string.
 * Accepts either an ISO date string or a Date object.
 * Handles both past and future dates gracefully.
 *
 * @param dateInput - Date to format (Date object or ISO string)
 * @param options - Formatting options (default: { compact: false })
 *
 * @example
 * formatRelativeTime(new Date()) // "just now"
 * formatRelativeTime("2024-01-15T10:00:00Z") // "3d ago"
 * formatRelativeTime(futureDate) // "in 2d" (for pending transactions)
 * formatRelativeTime(date, { compact: true }) // "2w ago" instead of "2 weeks ago"
 */
export function formatRelativeTime(dateInput: string | Date, options: RelativeTimeOptions = {}): string {
    const { compact = false } = options;
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const isFuture = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);
    const diffMins = Math.floor(absDiffMs / 60000);
    const diffHours = Math.floor(absDiffMs / 3600000);
    const diffDays = Math.floor(absDiffMs / 86400000);

    // Compact mode uses "today" for same-day; standard mode shows minutes/hours
    if (compact) {
        if (diffDays === 0) return 'today';
    } else {
        if (diffMins < 1) return 'just now';
        if (isFuture) {
            if (diffMins < 60) return `in ${diffMins}m`;
            if (diffHours < 24) return `in ${diffHours}h`;
        } else {
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
        }
    }

    if (diffDays === 1) return isFuture ? 'tomorrow' : 'yesterday';
    if (diffDays < 7) return isFuture ? `in ${diffDays}d` : `${diffDays}d ago`;

    const weeks = Math.floor(diffDays / 7);
    if (diffDays < 30) {
        if (compact) {
            return isFuture ? `in ${weeks}w` : `${weeks}w ago`;
        }
        return isFuture
            ? `in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
            : `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }

    // For compact mode, fall back to short date for older transactions
    if (compact) {
        return date.toLocaleDateString();
    }

    const months = Math.floor(diffDays / 30);
    return isFuture
        ? `in ${months} ${months === 1 ? 'month' : 'months'}`
        : `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

/**
 * Format a cache age as a human-readable string.
 * Shows how old cached data is, to help users understand data freshness.
 *
 * @param lastUpdate - ISO timestamp of when the cache was last updated
 * @returns A human-readable string like "(using cached data from 45m ago)"
 *
 * @example
 * formatCacheAge("2024-01-15T10:00:00Z") // "(using cached data from 2h ago)"
 * formatCacheAge(null) // "(using cached data)"
 */
export function formatCacheAge(lastUpdate: string | null): string {
    if (!lastUpdate) {
        return '(using cached data)';
    }

    const cacheDate = new Date(lastUpdate);
    const now = new Date();
    const diffMs = now.getTime() - cacheDate.getTime();

    // Handle invalid dates
    if (isNaN(diffMs)) {
        return '(using cached data)';
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) {
        return '(using cached data from just now)';
    }
    if (diffMins < 60) {
        return `(using cached data from ${diffMins}m ago)`;
    }
    if (diffHours < 24) {
        return `(using cached data from ${diffHours}h ago)`;
    }

    const diffDays = Math.floor(diffMs / 86400000);
    return `(using cached data from ${diffDays}d ago)`;
}

/**
 * Format a number as currency with $ sign.
 * Negative values are shown as -$X.XX
 * Uses NZ locale formatting with thousands separators.
 *
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(-99.50) // "-$99.50"
 */
export function formatCurrency(value: number): string {
    const formatted = Math.abs(value).toLocaleString('en-NZ', {
        minimumFractionDigits: NZD_DECIMAL_PLACES,
        maximumFractionDigits: NZD_DECIMAL_PLACES,
    });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format and output data in the specified format.
 * Supports arrays of objects (transactions, accounts, etc.) and category expense data.
 * @param data - Array of records or CategoryExpenseData object
 * @param format - Output format: json, csv, table, list, or ndjson
 * @param log - Logger function (defaults to console.log). Pass this.log from commands for proper oclif output.
 */
export function formatOutput(data: DataRecord[] | CategoryExpenseData, format: string, log: Logger = console.log): void {
    switch (format.toLowerCase()) {
        case 'json': {
            log(JSON.stringify(data, null, 2));
            break;
        }

        case 'ndjson': {
            formatAsNdjson(data, log);
            break;
        }

        case 'csv': {
            formatAsCsv(data, log);
            break;
        }

        case 'table': {
            formatAsTable(data, log);
            break;
        }

        case 'list':
        default: {
            formatAsList(data, log);
            break;
        }
    }
}

function formatAsTable(data: DataRecord[] | CategoryExpenseData, log: Logger): void {
    if (Array.isArray(data)) {
        formatArrayAsTable(data, log);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsTable(data, log);
    } else {
        // Type constraints should prevent this, but throw for safety
        throw new Error('Unsupported data format for table output. Expected array or category expense data.');
    }
}

function formatArrayAsTable(data: DataRecord[], log: Logger): void {
    if (data.length === 0) {
        log('No data available');
        return;
    }

    const headers = Object.keys(data[0]);

    // Calculate the maximum width for each column
    const colWidths = headers.map(header => {
        const headerWidth = header.length;
        const maxItemWidth = Math.max(...data.map(item => {
            const value = (item as Record<string, unknown>)[header];
            return String(value ?? '').length;
        }));
        return Math.min(Math.max(headerWidth, maxItemWidth) + 3, TABLE_MAX_COLUMN_WIDTH);
    });

    const table = new Table({
        colWidths,
        head: headers,
        style: { head: ['cyan'] },
    });

    for (const item of data) {
        const record = item as Record<string, unknown>;
        const row = headers.map(header => {
            const value = record[header];
            if ((header === 'balance' || header === 'availableBalance' || header === 'amount') && typeof value === 'number') {
                return formatCurrency(value);
            }
            // Convert to string for cli-table3 compatibility
            if (value === null || value === undefined) return '';
            if (value instanceof Date) return value.toLocaleDateString();
            return String(value);
        });
        table.push(row);
    }

    log(table.toString());
}

function formatExpensesByCategoryAsTable(data: CategoryExpenseData, log: Logger): void {
    const { expenses_by_category, months } = data;

    const headers = ['Category', ...months];

    const table = new Table({
        colWidths: [30, ...months.map(() => 15)],
        head: headers,
        style: { head: ['cyan'] },
    });

    for (const category of Object.keys(expenses_by_category)) {
        const row: string[] = [category];
        for (const month of months) {
            const amount = expenses_by_category[category][month] ?? 0;
            row.push(formatCurrency(amount));
        }
        table.push(row);
    }

    log(table.toString());
}

function formatAsCsv(data: DataRecord[] | CategoryExpenseData, log: Logger): void {
    if (Array.isArray(data)) {
        formatArrayAsCsv(data, log);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsCsv(data, log);
    } else {
        throw new Error('Unsupported data format for CSV output. Expected array or category expense data.');
    }
}

function formatAsNdjson(data: DataRecord[] | CategoryExpenseData, log: Logger): void {
    if (Array.isArray(data)) {
        formatArrayAsNdjson(data, log);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsNdjson(data, log);
    } else {
        throw new Error('Unsupported data format for NDJSON output. Expected array or category expense data.');
    }
}

function formatAsList(data: DataRecord[] | CategoryExpenseData, log: Logger): void {
    if (Array.isArray(data)) {
        formatArrayAsList(data, log);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsList(data, log);
    } else {
        throw new Error('Unsupported data format for list output. Expected array or category expense data.');
    }
}

function formatArrayAsCsv(data: DataRecord[], log: Logger): void {
    if (data.length === 0) {
        return;
    }

    const columns = Object.keys(data[0]);
    const csv = stringify(data, { columns, header: true });
    log(csv);
}

function formatExpensesByCategoryAsCsv(data: CategoryExpenseData, log: Logger): void {
    const { expenses_by_category, months } = data;

    const records: Input = [];

    for (const category of Object.keys(expenses_by_category)) {
        const record: Record<string, string> = { category };
        for (const month of months) {
            const amount = expenses_by_category[category][month] ?? 0;
            record[month] = amount.toFixed(2);
        }
        records.push(record);
    }

    const columns = ['category', ...months];

    const csv = stringify(records, { columns, header: true });
    log(csv);
}

function formatArrayAsList(data: DataRecord[], log: Logger): void {
    if (data.length === 0) {
        log('No data available');
        return;
    }

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        log(`\n[${i + 1}]`);

        for (const [key, value] of Object.entries(item)) {
            let displayValue: unknown = value;
            if ((key === 'balance' || key === 'availableBalance' || key === 'amount') && typeof value === 'number') {
                displayValue = formatCurrency(value);
            }
            // Handle null/undefined and Date for display
            if (displayValue === null || displayValue === undefined) {
                displayValue = '';
            } else if (displayValue instanceof Date) {
                displayValue = displayValue.toLocaleDateString();
            }
            log(`  ${key}: ${displayValue}`);
        }
    }
}

function formatExpensesByCategoryAsList(data: CategoryExpenseData, log: Logger): void {
    const { expenses_by_category, months } = data;

    log('\nExpenses by Category:');

    for (const category of Object.keys(expenses_by_category)) {
        log(`\n${category}:`);
        for (const month of months) {
            const amount = expenses_by_category[category][month] ?? 0;
            log(`  ${month}: ${formatCurrency(amount)}`);
        }
    }
}

function formatArrayAsNdjson(data: DataRecord[], log: Logger): void {
    if (data.length === 0) {
        return;
    }

    for (const item of data) {
        log(JSON.stringify(item));
    }
}

function formatExpensesByCategoryAsNdjson(data: CategoryExpenseData, log: Logger): void {
    const { expenses_by_category, months } = data;

    for (const category of Object.keys(expenses_by_category)) {
        const record: Record<string, string | number> = { category };
        for (const month of months) {
            const amount = expenses_by_category[category][month] ?? 0;
            record[month] = amount;
        }
        log(JSON.stringify(record));
    }
}