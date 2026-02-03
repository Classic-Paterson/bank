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
 * Format a timestamp as a human-readable relative time string.
 * Accepts either an ISO date string or a Date object.
 * Handles both past and future dates gracefully.
 *
 * @example
 * formatRelativeTime(new Date()) // "just now"
 * formatRelativeTime("2024-01-15T10:00:00Z") // "3d ago"
 * formatRelativeTime(futureDate) // "in 2d" (for pending transactions)
 */
export function formatRelativeTime(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const isFuture = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);
    const diffMins = Math.floor(absDiffMs / 60000);
    const diffHours = Math.floor(absDiffMs / 3600000);
    const diffDays = Math.floor(absDiffMs / 86400000);

    if (diffMins < 1) return 'just now';

    if (isFuture) {
        if (diffMins < 60) return `in ${diffMins}m`;
        if (diffHours < 24) return `in ${diffHours}h`;
        if (diffDays === 1) return 'tomorrow';
        if (diffDays < 7) return `in ${diffDays}d`;
        const weeks = Math.floor(diffDays / 7);
        if (diffDays < 30) return `in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
        const months = Math.floor(diffDays / 30);
        return `in ${months} ${months === 1 ? 'month' : 'months'}`;
    }

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    const weeks = Math.floor(diffDays / 7);
    if (diffDays < 30) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
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
 */
export function formatOutput(data: DataRecord[] | CategoryExpenseData, format: string): void {
    switch (format.toLowerCase()) {
        case 'json': {
            console.log(JSON.stringify(data, null, 2));
            break;
        }

        case 'ndjson': {
            formatAsNdjson(data);
            break;
        }

        case 'csv': {
            formatAsCsv(data);
            break;
        }

        case 'table': {
            formatAsTable(data);
            break;
        }

        case 'list':
        default: {
            formatAsList(data);
            break;
        }
    }
}

function formatAsTable(data: DataRecord[] | CategoryExpenseData): void {
    if (Array.isArray(data)) {
        formatArrayAsTable(data);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsTable(data);
    } else {
        // Type constraints should prevent this, but throw for safety
        throw new Error('Unsupported data format for table output. Expected array or category expense data.');
    }
}

function formatArrayAsTable(data: DataRecord[]): void {
    if (data.length === 0) {
        console.log('No data available');
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

    console.log(table.toString());
}

function formatExpensesByCategoryAsTable(data: CategoryExpenseData): void {
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

    console.log(table.toString());
}

function formatAsCsv(data: DataRecord[] | CategoryExpenseData): void {
    if (Array.isArray(data)) {
        formatArrayAsCsv(data);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsCsv(data);
    } else {
        throw new Error('Unsupported data format for CSV output. Expected array or category expense data.');
    }
}

function formatAsNdjson(data: DataRecord[] | CategoryExpenseData): void {
    if (Array.isArray(data)) {
        formatArrayAsNdjson(data);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsNdjson(data);
    } else {
        throw new Error('Unsupported data format for NDJSON output. Expected array or category expense data.');
    }
}

function formatAsList(data: DataRecord[] | CategoryExpenseData): void {
    if (Array.isArray(data)) {
        formatArrayAsList(data);
    } else if (isCategoryExpenseData(data)) {
        formatExpensesByCategoryAsList(data);
    } else {
        throw new Error('Unsupported data format for list output. Expected array or category expense data.');
    }
}

function formatArrayAsCsv(data: DataRecord[]): void {
    if (data.length === 0) {
        return;
    }

    const columns = Object.keys(data[0]);
    const csv = stringify(data, { columns, header: true });
    console.log(csv);
}

function formatExpensesByCategoryAsCsv(data: CategoryExpenseData): void {
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
    console.log(csv);
}

function formatArrayAsList(data: DataRecord[]): void {
    if (data.length === 0) {
        console.log('No data available');
        return;
    }

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        console.log(`\n[${i + 1}]`);

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
            console.log(`  ${key}: ${displayValue}`);
        }
    }
}

function formatExpensesByCategoryAsList(data: CategoryExpenseData): void {
    const { expenses_by_category, months } = data;

    console.log('\nExpenses by Category:');

    for (const category of Object.keys(expenses_by_category)) {
        console.log(`\n${category}:`);
        for (const month of months) {
            const amount = expenses_by_category[category][month] ?? 0;
            console.log(`  ${month}: ${formatCurrency(amount)}`);
        }
    }
}

function formatArrayAsNdjson(data: DataRecord[]): void {
    if (data.length === 0) {
        return;
    }

    for (const item of data) {
        console.log(JSON.stringify(item));
    }
}

function formatExpensesByCategoryAsNdjson(data: CategoryExpenseData): void {
    const { expenses_by_category, months } = data;

    for (const category of Object.keys(expenses_by_category)) {
        const record: Record<string, string | number> = { category };
        for (const month of months) {
            const amount = expenses_by_category[category][month] ?? 0;
            record[month] = amount;
        }
        console.log(JSON.stringify(record));
    }
}