/**
 * Shared flag definitions for CLI commands.
 * Centralizes common flag configurations to ensure consistency and reduce duplication.
 */

import { Flags, Command, Interfaces } from '@oclif/core';
import { OUTPUT_FORMATS, DEFAULT_FORMAT, DEFAULT_CACHE_ENABLED } from '../constants/index.js';
import { configService } from '../services/config.service.js';
import { cacheService } from '../services/cache.service.js';
import { validateOutputFormat, type OutputFormat } from './output.js';

/**
 * Maximum reasonable amount for filtering (100 billion).
 * This prevents issues with extremely large numbers that could cause
 * unexpected behavior in calculations or display.
 */
const AMOUNT_MAX_REASONABLE = 100_000_000_000;

/**
 * Custom flag for parsing decimal amounts (e.g., 99.50, 1000, 0.01).
 * Unlike Flags.integer(), this allows filtering by exact amounts.
 * Validates that the number is finite and within reasonable bounds.
 */
export const amountFlag = Flags.custom<number | undefined>({
  parse: async (input) => {
    const num = parseFloat(input);
    if (!Number.isFinite(num)) {
      throw new Error(`Invalid number: "${input}"`);
    }
    if (num < 0) {
      throw new Error(`Amount cannot be negative: "${input}"`);
    }
    if (num > AMOUNT_MAX_REASONABLE) {
      throw new Error(`Amount exceeds maximum allowed value (${AMOUNT_MAX_REASONABLE.toLocaleString()}): "${input}"`);
    }
    return num;
  },
});

/**
 * Common flag for forcing API refresh (bypassing cache).
 * Used by: accounts, transactions, categories, overview, query
 */
export const refreshFlag = Flags.boolean({
  char: 'r',
  description: 'Force refresh from API (bypass cache)',
  default: false,
});

/**
 * Common flag for suppressing informational messages.
 * When enabled, suppresses: cache status, summaries, tips, and category breakdowns.
 * Only the actual data is output, making it suitable for scripting and piping.
 * Used by: accounts, transactions, categories, overview
 */
export const quietFlag = Flags.boolean({
  char: 'q',
  description: 'Suppress informational messages (cache status, summaries, tips)',
  default: false,
});

/**
 * Common flag for output format selection.
 * Used by: accounts, transactions, categories, query
 */
export const formatFlag = Flags.string({
  char: 'f',
  description: 'Output format (json, csv, table, list, ndjson)',
  options: [...OUTPUT_FORMATS],
});

/**
 * Common flag for showing detailed information.
 * Used by: accounts, transactions, query
 */
export const detailsFlag = Flags.boolean({
  char: 'd',
  description: 'Show detailed info',
  default: false,
});

/**
 * Warn user if config file was corrupted on load.
 * Call at the start of command execution, before any output.
 * @param command - The command instance (for this.warn)
 * @param quiet - Whether quiet mode is enabled (skip warning if true)
 */
export function warnIfConfigCorrupted(command: Command, quiet = false): void {
  if (configService.hadLoadError && !quiet) {
    command.warn('Config file is corrupted or unreadable. Using defaults. Run `bank settings list` to reconfigure.');
  }
}

/**
 * Warn user if cache file was corrupted on load.
 * Call after cache operations that may have triggered a load.
 * @param command - The command instance (for this.warn)
 * @param quiet - Whether quiet mode is enabled (skip warning if true)
 */
export function warnIfCacheCorrupted(command: Command, quiet = false): void {
  if (cacheService.hadLoadError && !quiet) {
    command.warn('Cache file is corrupted or unreadable. Run `bank cache clear` to reset.');
  }
}

/**
 * Resolve the output format from flags and config, with validation.
 * Returns a normalized (lowercase) format string.
 * @param flagFormat - The format flag value (may be undefined)
 * @param defaultFormat - Fallback format if not specified anywhere (default: from constants)
 * @returns Normalized, validated output format
 * @throws Error if an invalid format is specified
 */
export function resolveFormat(flagFormat: string | undefined, defaultFormat: OutputFormat = DEFAULT_FORMAT): OutputFormat {
  const format = flagFormat ?? configService.get('format') ?? defaultFormat;
  return validateOutputFormat(format);
}

/**
 * Check if caching is enabled in config.
 * @returns true if caching is enabled, false otherwise
 */
export function isCacheEnabled(): boolean {
  return configService.get<boolean>('cacheData') ?? DEFAULT_CACHE_ENABLED;
}

/**
 * Date filtering flags for commands that query transactions by date range.
 * Provides consistent --since, --until, and --days flags.
 *
 * Usage: Spread into command's static flags object
 * @example
 * static flags = {
 *   ...dateFilterFlags(DEFAULT_TRANSACTION_DAYS_BACK),
 *   // other command-specific flags
 * };
 *
 * @param defaultDaysBack - Default days to look back when no date flags provided
 * @returns Object with since, until, and days flags
 */
export function dateFilterFlags(defaultDaysBack: number) {
  return {
    since: Flags.string({
      char: 's',
      description: 'Start date (YYYY-MM-DD, or: today, yesterday, 7d, 2w, 3m, thisweek, lastweek, thismonth, lastmonth, thisquarter, lastquarter, thisyear, lastyear)',
    }),
    until: Flags.string({
      char: 'u',
      description: 'End date (YYYY-MM-DD or shortcut like endoflastmonth, endofthisyear, endoflastyear, default: today)',
    }),
    days: Flags.integer({
      description: `Number of days to look back (default: ${defaultDaysBack}). Overrides --since if both provided.`,
    }),
  } as const;
}

/**
 * Type helper for extracting flag types from dateFilterFlags.
 * Use with Interfaces.InferredFlags to get proper typing.
 */
export type DateFilterFlags = Interfaces.InferredFlags<ReturnType<typeof dateFilterFlags>>;

/**
 * Represents a flag that is set (name and whether it's truthy).
 */
interface SetFlag {
  name: string;
  value: unknown;
}

/**
 * Check for mutually exclusive flags and return an error message if more than one is set.
 * This is a declarative way to validate flag conflicts without repetitive if-statements.
 *
 * @param flagEntries - Array of [flagName, flagValue] tuples to check
 * @returns null if valid (0 or 1 flag set), or an error message string if multiple flags are set
 *
 * @example
 * // In a command's run() method:
 * const conflict = checkMutuallyExclusiveFlags([
 *   ['--count', flags.count],
 *   ['--total', flags.total],
 *   ['--merchants', flags.merchants],
 * ]);
 * if (conflict) {
 *   this.error(conflict);
 * }
 */
export function checkMutuallyExclusiveFlags(
  flagEntries: Array<[string, unknown]>
): string | null {
  // Filter to only flags that are "set" (truthy, or explicitly !== undefined for numbers)
  const setFlags: SetFlag[] = flagEntries
    .filter(([, value]) => {
      // For numbers (like --top), 0 is falsy but still "set"
      if (typeof value === 'number') return true;
      // For booleans, only true counts as "set"
      if (typeof value === 'boolean') return value === true;
      // For strings and other values, truthy check
      return Boolean(value);
    })
    .map(([name, value]) => ({ name, value }));

  if (setFlags.length <= 1) {
    return null; // Valid: 0 or 1 flag set
  }

  // Format flag names consistently (ensure they have -- prefix)
  const flagNames = setFlags.map(f =>
    f.name.startsWith('--') ? f.name : `--${f.name}`
  );

  // Build a readable error message
  if (flagNames.length === 2) {
    return `Cannot use ${flagNames[0]} and ${flagNames[1]} together. Use only one.`;
  }

  // For 3+ flags, list all with Oxford comma
  const allButLast = flagNames.slice(0, -1).join(', ');
  const last = flagNames[flagNames.length - 1];
  return `Cannot use ${allButLast}, and ${last} together. Use only one.`;
}
