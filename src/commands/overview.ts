import { Command, Flags } from '@oclif/core';
import { Account } from 'akahu';
import chalk from 'chalk';

import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { internalTransferService } from '../services/internal-transfer.service.js';
import { budgetService } from '../services/budget.service.js';
import { FormattedTransaction, BudgetActual } from '../types/index.js';
import { isExcludedTransactionType, DEFAULT_OVERVIEW_DAYS_BACK, UNCATEGORIZED } from '../constants/index.js';
import { formatRelativeTime, formatCurrency, colorCurrency, formatCacheAge, sectionHeader } from '../utils/output.js';
import { getErrorMessage } from '../utils/error.js';
import { parseDateRange, formatDateISO } from '../utils/date.js';
import { refreshFlag, quietFlag, dateFilterFlags, warnIfConfigCorrupted, warnIfCacheCorrupted, isCacheEnabled, noTransfersFlag, resolveNoTransfers, getSelfPatterns } from '../utils/flags.js';

export default class Overview extends Command {
  static description = 'Display a financial dashboard with account balances, spending summary, and recent activity';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --days 30',
    '<%= config.bin %> <%= command.id %> --since thismonth       # Month to date',
    '<%= config.bin %> <%= command.id %> --since thisweek        # This week',
    '<%= config.bin %> <%= command.id %> --since thisquarter     # Quarter to date',
    '<%= config.bin %> <%= command.id %> --since 2024-01-01 --until 2024-01-31',
    '<%= config.bin %> <%= command.id %> --refresh',
    '<%= config.bin %> <%= command.id %> --compare               # Compare with previous period',
    '<%= config.bin %> <%= command.id %> --since thismonth --compare  # This month vs last month',
    '<%= config.bin %> <%= command.id %> --account "Everyday"    # Overview for a specific account',
  ];

  static override flags = {
    ...dateFilterFlags(DEFAULT_OVERVIEW_DAYS_BACK),
    account: Flags.string({
      char: 'a',
      description: 'Filter to a specific account (by ID or name)',
    }),
    refresh: refreshFlag,
    quiet: quietFlag,
    compare: Flags.boolean({
      description: 'Compare with previous period (e.g., this month vs last month)',
      default: false,
    }),
    noTransfers: noTransfersFlag,
  };

  /**
   * Render a compact budget progress block - shows expense lines with how
   * actuals compare to expected (pro-rated for the window). Sorted by the
   * largest variance so over/under-budget items surface first.
   */
  private renderBudgetProgress(actuals: BudgetActual[]): void {
    // Focus on out (expense) lines for the dashboard. Savings/income lines
    // are handled by the dedicated `bank budget` view.
    const expenseLines = actuals.filter(a => a.line.direction === 'out');
    if (expenseLines.length === 0) return;

    // Surface the most actionable lines: biggest absolute variance OR over
    // pace. Cap at 8 lines so the dashboard stays scannable.
    const sortedByConcern = [...expenseLines].sort((a, b) => {
      // Over-budget first (pace > 1), sorted by variance magnitude
      const aOver = a.paceRatio > 1.05;
      const bOver = b.paceRatio > 1.05;
      if (aOver !== bOver) return aOver ? -1 : 1;
      return Math.abs(b.actual - b.expected) - Math.abs(a.actual - a.expected);
    }).slice(0, 8);

    this.log(chalk.bold('  BUDGET PROGRESS'));
    const nameWidth = Math.min(
      28,
      Math.max(...sortedByConcern.map(a => a.line.subcategory.length), 10)
    );
    for (const a of sortedByConcern) {
      const name = a.line.subcategory.length > nameWidth
        ? a.line.subcategory.slice(0, nameWidth - 1) + '…'
        : a.line.subcategory.padEnd(nameWidth);
      const expected = a.expected > 0 ? `$${a.expected.toFixed(0)}` : '--';
      const actual = `$${a.actual.toFixed(0)}`;
      const pacePct = a.expected > 0 ? `${Math.round(a.paceRatio * 100)}%` : '--';
      let paceColored: string;
      if (a.expected === 0) paceColored = chalk.dim(pacePct);
      else if (a.paceRatio > 1.2) paceColored = chalk.red(pacePct);
      else if (a.paceRatio > 1.05) paceColored = chalk.yellow(pacePct);
      else paceColored = chalk.green(pacePct);

      // Visual bar capped at 1.5x for display
      const barFill = Math.min(20, Math.round((a.paceRatio || 0) * 20));
      const barColor = a.paceRatio > 1.05 ? chalk.red : a.paceRatio > 0.95 ? chalk.yellow : chalk.green;
      const bar = barColor('█'.repeat(barFill)) + chalk.dim('░'.repeat(Math.max(0, 20 - barFill)));

      this.log(`  ${bar} ${actual.padStart(7)} / ${expected.padStart(7)}  ${paceColored.padStart(4)}  ${name}`);
    }
    this.log('');
  }

  /**
   * Format a percentage change with trend arrow and color.
   * For spending (negative values), increases are bad (red ↑), decreases are good (green ↓).
   * For income (positive values), increases are good (green ↑), decreases are bad (red ↓).
   */
  private formatChange(current: number, previous: number, isSpending: boolean): string {
    if (previous === 0) {
      return current === 0 ? chalk.dim('--') : chalk.dim('new');
    }

    const percentChange = ((current - previous) / Math.abs(previous)) * 100;
    const absPercent = Math.abs(percentChange).toFixed(0);

    if (Math.abs(percentChange) < 1) {
      return chalk.dim('~0%');
    }

    if (percentChange > 0) {
      // Increase: bad for spending, good for income
      const arrow = '↑';
      const text = `${arrow}${absPercent}%`;
      return isSpending ? chalk.red(text) : chalk.green(text);
    } else {
      // Decrease: good for spending, bad for income
      const arrow = '↓';
      const text = `${arrow}${absPercent}%`;
      return isSpending ? chalk.green(text) : chalk.red(text);
    }
  }

  /**
   * Calculate the previous period dates based on current period.
   * Returns dates for a period of the same length, immediately before the current period.
   */
  private getPreviousPeriod(startParsed: Date, endParsed: Date): { prevStart: Date; prevEnd: Date } {
    const periodMs = endParsed.getTime() - startParsed.getTime();
    const prevEnd = new Date(startParsed.getTime() - 1); // Day before current start
    const prevStart = new Date(prevEnd.getTime() - periodMs);
    return { prevStart, prevEnd };
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Overview);

    warnIfConfigCorrupted(this, flags.quiet);

    // Parse and validate date range using shared utility
    const dateResult = parseDateRange({
      since: flags.since,
      until: flags.until,
      days: flags.days,
      defaultDaysBack: DEFAULT_OVERVIEW_DAYS_BACK,
      onWarning: flags.quiet ? undefined : (msg) => this.warn(msg),
    });
    if (!dateResult.success) {
      this.error(dateResult.error);
    }
    const { startDate: sinceDate, endDate: untilDate, startParsed, endParsed } = dateResult;

    const cacheEnabled = isCacheEnabled();

    try {
      // Fetch accounts with caching
      const accResult = await cacheService.getAccountsWithCache(
        flags.refresh,
        cacheEnabled,
        () => apiService.listAccounts()
      );
      let accounts = accResult.accounts;

      // Filter to specific account if requested
      let selectedAccount: Account | undefined;
      if (flags.account) {
        const accountFilter = flags.account.toLowerCase();
        selectedAccount = accounts.find((acc: Account) =>
          acc._id === flags.account ||
          acc.name.toLowerCase().includes(accountFilter)
        );

        if (!selectedAccount) {
          this.error(`Account "${flags.account}" not found. Use 'bank accounts --names' to list available accounts.`);
        }

        // When filtering by account, only show that account
        accounts = [selectedAccount];
      }

      // Fetch transactions with caching
      const txResult = await cacheService.getTransactionsWithCache(
        sinceDate,
        untilDate,
        flags.refresh,
        cacheEnabled,
        () => apiService.listAllTransactions(sinceDate, untilDate)
      );
      let transactions = txResult.transactions;
      let fromCache = accResult.fromCache || txResult.fromCache;
      // Use the oldest cache age for display
      let cacheAge = txResult.cacheAge || accResult.cacheAge;

      // Filter transactions to selected account if specified
      if (selectedAccount) {
        transactions = transactions.filter(tx => tx._account === selectedAccount!._id);
      }

      // Format transactions for analysis
      const formattedTransactions = transactionProcessingService.formatTransactions(transactions, accResult.accounts);

      // Detect internal transfers (between user's own linked accounts) and
      // optionally filter them out of spending/income calculations.
      const noTransfers = resolveNoTransfers(flags.noTransfers);
      const internalAnnotations = noTransfers
        ? internalTransferService.annotate(formattedTransactions, { selfPatterns: getSelfPatterns() })
        : new Map();
      const isInternal = (tx: FormattedTransaction) =>
        noTransfers && internalAnnotations.get(tx.id)?.isInternal === true;

      // Fetch previous period data if comparing
      let prevSpending = 0;
      let prevIncome = 0;
      let prevCategorySpending: Record<string, number> = {};
      if (flags.compare) {
        const { prevStart, prevEnd } = this.getPreviousPeriod(startParsed, endParsed);
        const prevStartStr = formatDateISO(prevStart);
        const prevEndStr = formatDateISO(prevEnd);

        const prevTxResult = await cacheService.getTransactionsWithCache(
          prevStartStr,
          prevEndStr,
          flags.refresh,
          cacheEnabled,
          () => apiService.listAllTransactions(prevStartStr, prevEndStr)
        );

        fromCache = fromCache || prevTxResult.fromCache;
        if (prevTxResult.cacheAge && (!cacheAge || new Date(prevTxResult.cacheAge) < new Date(cacheAge))) {
          cacheAge = prevTxResult.cacheAge;
        }

        // Filter previous period transactions to selected account if specified
        let prevTransactions = prevTxResult.transactions;
        if (selectedAccount) {
          prevTransactions = prevTransactions.filter(tx => tx._account === selectedAccount!._id);
        }

        const prevFormattedTx = transactionProcessingService.formatTransactions(prevTransactions, accResult.accounts);
        const prevInternalAnnotations = noTransfers
          ? internalTransferService.annotate(prevFormattedTx, { selfPatterns: getSelfPatterns() })
          : new Map();
        const prevIsInternal = (tx: FormattedTransaction) =>
          noTransfers && prevInternalAnnotations.get(tx.id)?.isInternal === true;

        prevSpending = prevFormattedTx
          .filter((tx: FormattedTransaction) => tx.amount < 0 && !isExcludedTransactionType(tx.type) && !prevIsInternal(tx))
          .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

        prevIncome = prevFormattedTx
          .filter((tx: FormattedTransaction) => tx.amount > 0 && !isExcludedTransactionType(tx.type) && !prevIsInternal(tx))
          .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

        prevCategorySpending = prevFormattedTx
          .filter((tx: FormattedTransaction) => tx.amount < 0 && !isExcludedTransactionType(tx.type) && !prevIsInternal(tx) && tx.parentCategory)
          .reduce((acc: Record<string, number>, tx: FormattedTransaction) => {
            const category = tx.parentCategory || UNCATEGORIZED;
            acc[category] = (acc[category] || 0) + Math.abs(tx.amount);
            return acc;
          }, {});
      }

      // Calculate totals
      const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance?.current ?? 0), 0);
      const accountCount = accounts.length;

      // Separate by account type
      const accountsByType = accounts.reduce((groups: Record<string, Account[]>, acc) => {
        const type = acc.type || 'Other';
        if (!groups[type]) groups[type] = [];
        groups[type].push(acc);
        return groups;
      }, {});

      // Calculate spending (negative amounts, excluding transfers)
      const spending = formattedTransactions
        .filter((tx: FormattedTransaction) =>
          tx.amount < 0 &&
          !isExcludedTransactionType(tx.type) &&
          !isInternal(tx)
        )
        .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

      // Calculate income (positive amounts, excluding transfers)
      const income = formattedTransactions
        .filter((tx: FormattedTransaction) =>
          tx.amount > 0 &&
          !isExcludedTransactionType(tx.type) &&
          !isInternal(tx)
        )
        .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

      // Get pending transactions (transactions without a settled date are pending)
      const pendingTransactions = transactions.filter(tx => !tx.date);
      const pendingTotal = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      // Category breakdown (top 5 spending categories)
      const categorySpending = formattedTransactions
        .filter((tx: FormattedTransaction) =>
          tx.amount < 0 &&
          !isExcludedTransactionType(tx.type) &&
          !isInternal(tx) &&
          tx.parentCategory
        )
        .reduce((acc: Record<string, number>, tx: FormattedTransaction) => {
          const category = tx.parentCategory || UNCATEGORIZED;
          acc[category] = (acc[category] || 0) + Math.abs(tx.amount);
          return acc;
        }, {});

      const topCategories = Object.entries(categorySpending)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      // Get cache info
      const cacheInfo = cacheService.getCacheInfo();

      // Warn if cache was corrupted on load
      warnIfCacheCorrupted(this, flags.quiet);

      // ═══════════════════════════════════════════════════════════════
      // DISPLAY OUTPUT
      // ═══════════════════════════════════════════════════════════════

      const headerTitle = selectedAccount
        ? `FINANCIAL OVERVIEW: ${selectedAccount.name}`
        : 'FINANCIAL OVERVIEW';
      sectionHeader(headerTitle, this.log.bind(this));

      if (fromCache && !flags.quiet) {
        this.log(chalk.dim(`  ${formatCacheAge(cacheAge)}`));
      }
      this.log('');

      // Net Worth Section
      this.log(chalk.bold('  NET WORTH'));
      this.log(`  ${colorCurrency(totalBalance)} ${chalk.dim(`across ${accountCount} accounts`)}`);
      this.log('');

      // Account breakdown by type
      for (const [type, accs] of Object.entries(accountsByType)) {
        const typeTotal = accs.reduce((sum, acc) => sum + (acc.balance?.current ?? 0), 0);
        this.log(chalk.dim(`  ${type.toUpperCase()}`));
        for (const acc of accs.sort((a, b) => (b.balance?.current ?? 0) - (a.balance?.current ?? 0))) {
          const balance = acc.balance?.current ?? 0;
          const balanceStr = formatCurrency(balance);
          const padding = ' '.repeat(Math.max(1, 30 - acc.name.length));
          this.log(`    ${acc.name}${padding}${balance >= 0 ? chalk.green(balanceStr) : chalk.red(balanceStr)}`);
        }
        this.log(chalk.dim(`    ${'─'.repeat(38)}`));
        this.log(`    ${chalk.bold('Subtotal')}${' '.repeat(22)}${colorCurrency(typeTotal)}`);
        this.log('');
      }

      // This Period Section
      // Calculate days in range for display
      const daysInRange = Math.ceil((endParsed.getTime() - startParsed.getTime()) / (1000 * 60 * 60 * 24));
      const periodLabel = daysInRange === 1 ? '1 day' : `${daysInRange} days`;
      sectionHeader(`THIS PERIOD (${sinceDate} to ${untilDate}, ${periodLabel})`, this.log.bind(this));
      this.log('');
      if (flags.compare) {
        const incomeChange = this.formatChange(income, prevIncome, false);
        const spendingChange = this.formatChange(Math.abs(spending), Math.abs(prevSpending), true);
        const netChange = this.formatChange(income + spending, prevIncome + prevSpending, false);
        this.log(`  Income:    ${colorCurrency(income)}  ${incomeChange}`);
        this.log(`  Spending:  ${colorCurrency(spending)}  ${spendingChange}`);
        this.log(`  Net:       ${colorCurrency(income + spending)}  ${netChange}`);
      } else {
        this.log(`  Income:    ${colorCurrency(income)}`);
        this.log(`  Spending:  ${colorCurrency(spending)}`);
        this.log(`  Net:       ${colorCurrency(income + spending)}`);
      }

      if (noTransfers && !flags.quiet) {
        const summary = internalTransferService.summarize(formattedTransactions, internalAnnotations);
        if (summary.count > 0) {
          this.log(chalk.dim(`  (excluded ${summary.count} internal transfer legs, ~${formatCurrency(summary.absTotal)} between your accounts)`));
        }
      }

      // Daily spending rate indicator
      if (daysInRange > 1 && Math.abs(spending) > 0) {
        const dailyRate = Math.abs(spending) / daysInRange;
        const daysElapsed = Math.ceil((new Date().getTime() - startParsed.getTime()) / (1000 * 60 * 60 * 24));
        // Clamp daysElapsed to the period range (handle viewing past periods)
        const effectiveDaysElapsed = Math.min(Math.max(daysElapsed, 1), daysInRange);
        const expectedSpending = dailyRate * effectiveDaysElapsed;
        const actualSpending = Math.abs(spending);

        // Only show pace if we're partway through the period (not viewing complete past periods)
        const isPeriodComplete = daysElapsed >= daysInRange;
        if (!isPeriodComplete) {
          const paceRatio = actualSpending / expectedSpending;
          const paceLabel = paceRatio <= 1.0
            ? chalk.green('on pace')
            : paceRatio <= 1.2
              ? chalk.yellow('slightly over')
              : chalk.red('over pace');
          this.log(`  Daily avg: ${formatCurrency(dailyRate)}/day  ${paceLabel}`);
        } else {
          this.log(`  Daily avg: ${formatCurrency(dailyRate)}/day`);
        }
      }
      this.log('');

      // Budget progress takes priority over generic top-spending when a
      // budget has been imported.
      const budget = budgetService.load();
      if (budget && budget.lines.length > 0) {
        const { actuals } = budgetService.computeActuals(
          budget.lines,
          formattedTransactions,
          startParsed,
          endParsed
        );
        this.renderBudgetProgress(actuals);
      } else if (topCategories.length > 0) {
        this.log(chalk.bold('  TOP SPENDING'));
        const maxSpend = topCategories[0]?.[1] ?? 0;
        for (const [category, amount] of topCategories) {
          const barLength = Math.round((amount / maxSpend) * 20);
          const bar = chalk.red('█'.repeat(barLength)) + chalk.dim('░'.repeat(20 - barLength));
          const amountStr = `$${amount.toFixed(0)}`.padStart(8);
          if (flags.compare) {
            const prevAmount = prevCategorySpending[category] || 0;
            const change = this.formatChange(amount, prevAmount, true);
            this.log(`  ${bar} ${amountStr}  ${category}  ${change}`);
          } else {
            this.log(`  ${bar} ${amountStr}  ${category}`);
          }
        }
        this.log('');
      }

      // Pending Transactions
      if (pendingTransactions.length > 0) {
        sectionHeader('PENDING', this.log.bind(this));
        this.log(`  ${pendingTransactions.length} transactions (${formatCurrency(pendingTotal)})`);
        this.log('');
      }

      // Recent Activity (last 5 transactions) - excludes internals when --noTransfers is on
      const recentTransactions = formattedTransactions
        .filter((tx: FormattedTransaction) => !isInternal(tx))
        .sort((a: FormattedTransaction, b: FormattedTransaction) => b.date.getTime() - a.date.getTime())
        .slice(0, 5);

      if (recentTransactions.length > 0) {
        sectionHeader('RECENT ACTIVITY', this.log.bind(this));
        for (const tx of recentTransactions) {
          const timeAgo = formatRelativeTime(tx.date);
          const desc = tx.merchant || tx.description;
          const truncatedDesc = desc.length > 25 ? desc.substring(0, 22) + '...' : desc;
          const padding = ' '.repeat(Math.max(1, 26 - truncatedDesc.length));
          const amountStr = formatCurrency(tx.amount);
          this.log(`  ${chalk.dim(timeAgo.padEnd(12))}${truncatedDesc}${padding}${tx.amount >= 0 ? chalk.green(amountStr) : chalk.red(amountStr)}`);
        }
        this.log('');
      }

      // Cache Status (only show when not in quiet mode)
      if (cacheEnabled && !flags.quiet) {
        sectionHeader('CACHE STATUS', this.log.bind(this));
        const txLastUpdate = cacheInfo.transactions.lastUpdate
          ? formatRelativeTime(new Date(cacheInfo.transactions.lastUpdate))
          : 'never';
        const accLastUpdate = cacheInfo.accounts.lastUpdate
          ? formatRelativeTime(new Date(cacheInfo.accounts.lastUpdate))
          : 'never';
        this.log(chalk.dim(`  Transactions: ${cacheInfo.transactions.count} cached (updated ${txLastUpdate})`));
        this.log(chalk.dim(`  Accounts: ${cacheInfo.accounts.count} cached (updated ${accLastUpdate})`));
        this.log('');
      }

    } catch (error) {
      this.error(`Error fetching data: ${getErrorMessage(error)}`);
    }
  }
}
