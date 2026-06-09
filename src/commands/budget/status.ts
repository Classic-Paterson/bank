import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';

import { apiService } from '../../services/api.service.js';
import { cacheService } from '../../services/cache.service.js';
import { transactionProcessingService } from '../../services/transaction-processing.service.js';
import { internalTransferService } from '../../services/internal-transfer.service.js';
import { budgetService } from '../../services/budget.service.js';
import {
  refreshFlag, quietFlag, formatFlag, dateFilterFlags,
  warnIfConfigCorrupted, warnIfCacheCorrupted, isCacheEnabled,
  noTransfersFlag, resolveNoTransfers, getSelfPatterns,
} from '../../utils/flags.js';
import { DEFAULT_OVERVIEW_DAYS_BACK, isExcludedTransactionType } from '../../constants/index.js';
import { parseDateRange } from '../../utils/date.js';
import { formatCurrency, formatOutput, sectionHeader, validateOutputFormat } from '../../utils/output.js';
import { getErrorMessage } from '../../utils/error.js';
import { BudgetActual } from '../../types/index.js';

export default class BudgetStatus extends Command {
  static description = 'Show actuals vs budget for a date window, with pace indicators.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>                       # Last 30 days',
    '<%= config.bin %> <%= command.id %> --since thismonth     # Month to date',
    '<%= config.bin %> <%= command.id %> --since lastmonth --until endoflastmonth',
    '<%= config.bin %> <%= command.id %> --format csv          # CSV for spreadsheet',
    '<%= config.bin %> <%= command.id %> --unmatched           # Show only lines without matchers',
  ];

  static override flags = {
    ...dateFilterFlags(DEFAULT_OVERVIEW_DAYS_BACK),
    format: formatFlag,
    refresh: refreshFlag,
    quiet: quietFlag,
    noTransfers: noTransfersFlag,
    unmatched: Flags.boolean({
      description: 'Show only budget lines whose actual is $0 (so you can spot missing matchers or unused lines)',
      default: false,
    }),
    grouped: Flags.boolean({
      description: 'Group by category header rows (default for table view)',
      default: true,
      allowNo: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(BudgetStatus);

    warnIfConfigCorrupted(this, flags.quiet);

    const budget = budgetService.load();
    if (!budget) {
      this.log(chalk.yellow('No budget imported yet.'));
      this.log('Run: bank budget import <path-to-csv>');
      return;
    }

    const dateResult = parseDateRange({
      since: flags.since,
      until: flags.until,
      days: flags.days,
      defaultDaysBack: DEFAULT_OVERVIEW_DAYS_BACK,
      onWarning: flags.quiet ? undefined : (msg) => this.warn(msg),
    });
    if (!dateResult.success) this.error(dateResult.error);
    const { startDate, endDate, startParsed, endParsed } = dateResult;

    // Default to the table view (human-friendly) unless an explicit -f was
    // passed. We intentionally ignore the global config default (which is
    // often json for scripting) because the budget view is a dashboard.
    const format = flags.format ? validateOutputFormat(flags.format) : 'table';
    const cacheEnabled = isCacheEnabled();

    try {
      const spinner = ora('Fetching transactions...').start();
      const txResult = await cacheService.getTransactionsWithCache(
        startDate, endDate, flags.refresh, cacheEnabled,
        () => apiService.listAllTransactions(startDate, endDate)
      );
      const accResult = await cacheService.getAccountsWithCache(
        flags.refresh, cacheEnabled,
        () => apiService.listAccounts()
      );
      spinner.stop();
      warnIfCacheCorrupted(this, flags.quiet);

      const transactions = transactionProcessingService.formatTransactions(
        txResult.transactions, accResult.accounts
      );

      // Match against budget lines FIRST (mortgage AP, savings allocations,
      // etc. are technically internal but are real budget items). Then for
      // transactions that didn't match any line, exclude internal pairs.
      const noTransfers = resolveNoTransfers(flags.noTransfers);
      const internalAnnotations = noTransfers
        ? internalTransferService.annotate(transactions, { selfPatterns: getSelfPatterns() })
        : new Map();

      const { actuals, matchedIds } = budgetService.computeActuals(
        budget.lines, transactions, startParsed, endParsed
      );

      // Unaccounted: transactions not matched to any budget line, and not
      // filtered as internal (when --noTransfers is on). Split by direction.
      let unaccountedSpend = 0;
      let unaccountedSpendCount = 0;
      let unaccountedIncome = 0;
      let unaccountedIncomeCount = 0;
      let internalFiltered = 0;
      for (const tx of transactions) {
        if (matchedIds.has(tx.id)) continue;
        if (isExcludedTransactionType(tx.type)) continue;
        if (noTransfers && internalAnnotations.get(tx.id)?.isInternal) {
          internalFiltered++;
          continue;
        }
        if (tx.amount < 0) {
          unaccountedSpend += Math.abs(tx.amount);
          unaccountedSpendCount++;
        } else if (tx.amount > 0) {
          unaccountedIncome += tx.amount;
          unaccountedIncomeCount++;
        }
      }

      if (format !== 'table' && format !== 'list') {
        // For json/csv/ndjson, emit a clean serialisable shape
        const rows = (flags.unmatched ? actuals.filter(a => a.actual === 0) : actuals)
          .map(a => ({
            category: a.line.category,
            subcategory: a.line.subcategory,
            direction: a.line.direction,
            period: a.line.period,
            budgetedAmount: a.line.amount,
            expected: round2(a.expected),
            actual: round2(a.actual),
            variance: round2(a.actual - a.expected),
            paceRatio: a.expected > 0 ? round2(a.paceRatio) : null,
            transactions: a.count,
          }));
        formatOutput(rows, format, this.log.bind(this));
        return;
      }

      // Table output: render with category headers and grouped totals
      this.renderTable(actuals, flags.unmatched, flags.grouped);

      // Unaccounted block - transactions that didn't match any line and aren't internal.
      if (unaccountedSpendCount > 0 || unaccountedIncomeCount > 0) {
        this.log('');
        sectionHeader('UNACCOUNTED', this.log.bind(this));
        if (unaccountedSpendCount > 0) {
          this.log(`  Spending not matched to a budget line: ${chalk.red(formatCurrency(-unaccountedSpend))} (${unaccountedSpendCount} txns)`);
        }
        if (unaccountedIncomeCount > 0) {
          this.log(`  Income not matched to a budget line:   ${chalk.green(formatCurrency(unaccountedIncome))} (${unaccountedIncomeCount} txns)`);
        }
        this.log(chalk.dim('  Use: bank transactions --since ' + startDate + ' --until ' + endDate + ' --noTransfers'));
        this.log(chalk.dim('  ...to dig in, then `bank budget matcher add` to assign them.'));
      }

      if (!flags.quiet) {
        this.log('');
        const dayCount = Math.ceil(
          (endParsed.getTime() - startParsed.getTime()) / 86_400_000
        );
        this.log(chalk.dim(`Window: ${startDate} to ${endDate} (${dayCount} days)`));
        if (noTransfers && internalFiltered > 0) {
          this.log(chalk.dim(`Filtered ${internalFiltered} internal transfer leg${internalFiltered === 1 ? '' : 's'} not matched to any line.`));
        }
        const missing = budget.lines.filter(l => l.matchers.length === 0).length;
        if (missing > 0) {
          this.log(chalk.yellow(`${missing} budget line${missing === 1 ? '' : 's'} have no matchers - their actuals will always be $0. Run \`bank budget show --unmatched\`.`));
        }
      }
    } catch (e) {
      this.error(`Error: ${getErrorMessage(e)}`);
    }
  }

  /**
   * Dense, single-pass renderer. Avoids cli-table3 because it adds a
   * horizontal divider between every row and forces fixed column widths
   * that either truncate currency or waste space on narrow values like
   * "annual" / "94%". We size columns to fit the data and use a section
   * header per category rather than a separate table.
   */
  private renderTable(
    actuals: BudgetActual[],
    unmatchedOnly: boolean,
    grouped: boolean,
  ): void {
    const filtered = unmatchedOnly ? actuals.filter(a => a.actual === 0) : actuals;
    if (filtered.length === 0) return;

    const byCategory = new Map<string, BudgetActual[]>();
    for (const a of filtered) {
      const arr = byCategory.get(a.line.category) ?? [];
      arr.push(a);
      byCategory.set(a.line.category, arr);
    }

    sectionHeader('BUDGET STATUS', this.log.bind(this));

    // Pre-compute column widths from the actual data so nothing truncates.
    const nameW = Math.min(
      40,
      Math.max(4, ...filtered.map(a => a.line.subcategory.length))
    );
    const budgetW = Math.max(
      'Budget'.length,
      ...filtered.map(a => formatCurrency(a.line.amount).length)
    );
    const moneyW = Math.max(
      'Expected'.length,
      ...filtered.map(a => Math.max(
        formatCurrency(a.expected).length,
        formatCurrency(a.actual).length,
        formatCurrency(a.actual - a.expected).length,
      )),
    );
    // Pace is at most '999%' or '--' (4 chars)
    const paceW = 5;
    const countW = Math.max(2, ...filtered.map(a => String(a.count).length));

    // Header row
    const header = [
      chalk.dim('Line'.padEnd(nameW)),
      chalk.dim('Budget'.padStart(budgetW)),
      chalk.dim('Expected'.padStart(moneyW)),
      chalk.dim('Actual'.padStart(moneyW)),
      chalk.dim('Variance'.padStart(moneyW)),
      chalk.dim('Pace'.padStart(paceW)),
      chalk.dim('#'.padStart(countW)),
    ].join('  ');
    this.log('  ' + header);

    for (const [category, rows] of byCategory) {
      if (grouped) {
        this.log('  ' + chalk.bold.cyan(category));
      }

      let totalExpected = 0, totalActual = 0;
      for (const a of rows) {
        const variance = a.actual - a.expected;
        const pace = this.formatPace(a.paceRatio, a.line.direction, paceW);
        const varianceStr = this.colorPaddedMoney(
          variance, moneyW, a.line.direction === 'out',
        );
        const name = a.line.subcategory.length > nameW
          ? a.line.subcategory.slice(0, nameW - 1) + '…'
          : a.line.subcategory.padEnd(nameW);
        const row = [
          '  ' + name,
          formatCurrency(a.line.amount).padStart(budgetW),
          formatCurrency(a.expected).padStart(moneyW),
          formatCurrency(a.actual).padStart(moneyW),
          varianceStr,
          pace,
          String(a.count).padStart(countW),
        ].join('  ');
        this.log(row);
        totalExpected += a.expected;
        totalActual += a.actual;
      }

      // Per-category subtotal row, indented and de-emphasised
      const totalVar = totalActual - totalExpected;
      const subtotal = [
        '  ' + chalk.dim('Subtotal'.padEnd(nameW)),
        chalk.dim(' '.repeat(budgetW)),
        chalk.bold(formatCurrency(totalExpected).padStart(moneyW)),
        chalk.bold(formatCurrency(totalActual).padStart(moneyW)),
        this.colorPaddedMoney(totalVar, moneyW, true, /* bold */ true),
        chalk.dim(''.padStart(paceW)),
        chalk.dim(''.padStart(countW)),
      ].join('  ');
      this.log(subtotal);
      this.log('');
    }
  }

  /** Format a money value with right-padding and an over/under colour. */
  private colorPaddedMoney(
    amount: number, width: number, redIfPositive: boolean, bold = false,
  ): string {
    const text = formatCurrency(amount).padStart(width);
    const wrapped = bold ? chalk.bold(text) : text;
    if (Math.abs(amount) < 1) return chalk.dim(wrapped);
    if (amount > 0) return redIfPositive ? chalk.red(wrapped) : chalk.green(wrapped);
    return redIfPositive ? chalk.green(wrapped) : chalk.red(wrapped);
  }

  private formatPace(paceRatio: number, direction: string, width = 5): string {
    if (paceRatio === 0) return chalk.dim('--'.padStart(width));
    const text = `${(paceRatio * 100).toFixed(0)}%`.padStart(width);
    // For expense lines: over budget = red, under = green
    // For income/savings lines: over = green (more income), under = red
    const isOverBudget = paceRatio > 1.05;
    const isUnderBudget = paceRatio < 0.95;
    if (direction === 'out') {
      if (isOverBudget) return chalk.red(text);
      if (isUnderBudget) return chalk.green(text);
      return chalk.yellow(text);
    } else {
      if (isOverBudget) return chalk.green(text);
      if (isUnderBudget) return chalk.red(text);
      return chalk.yellow(text);
    }
  }

}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
