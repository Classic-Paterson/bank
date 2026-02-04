import { Command, Flags } from '@oclif/core';
import { Account } from 'akahu';
import chalk from 'chalk';

import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { FormattedTransaction } from '../types/index.js';
import { isExcludedTransactionType, DEFAULT_OVERVIEW_DAYS_BACK, UNCATEGORIZED } from '../constants/index.js';
import { formatRelativeTime, formatCurrency, formatCacheAge } from '../utils/output.js';
import { getErrorMessage } from '../utils/error.js';
import { parseDateRange, formatDateISO } from '../utils/date.js';
import { refreshFlag, quietFlag, dateFilterFlags, warnIfConfigCorrupted, warnIfCacheCorrupted, isCacheEnabled } from '../utils/flags.js';

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
  };

  /**
   * Apply chalk coloring to a formatted currency string.
   * Green for positive, red for negative.
   */
  private colorCurrency(amount: number): string {
    const formatted = formatCurrency(amount);
    return amount < 0 ? chalk.red(formatted) : chalk.green(formatted);
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

        prevSpending = prevFormattedTx
          .filter((tx: FormattedTransaction) => tx.amount < 0 && !isExcludedTransactionType(tx.type))
          .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

        prevIncome = prevFormattedTx
          .filter((tx: FormattedTransaction) => tx.amount > 0 && !isExcludedTransactionType(tx.type))
          .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

        prevCategorySpending = prevFormattedTx
          .filter((tx: FormattedTransaction) => tx.amount < 0 && !isExcludedTransactionType(tx.type) && tx.parentCategory)
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
          !isExcludedTransactionType(tx.type)
        )
        .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

      // Calculate income (positive amounts, excluding transfers)
      const income = formattedTransactions
        .filter((tx: FormattedTransaction) =>
          tx.amount > 0 &&
          !isExcludedTransactionType(tx.type)
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

      this.log('');
      const headerTitle = selectedAccount
        ? `  FINANCIAL OVERVIEW: ${selectedAccount.name}`
        : '  FINANCIAL OVERVIEW';
      this.log(chalk.bold(headerTitle));
      this.log(chalk.dim('  ─────────────────────────────────────────────'));

      if (fromCache && !flags.quiet) {
        this.log(chalk.dim(`  ${formatCacheAge(cacheAge)}`));
      }
      this.log('');

      // Net Worth Section
      this.log(chalk.bold('  NET WORTH'));
      this.log(`  ${this.colorCurrency(totalBalance)} ${chalk.dim(`across ${accountCount} accounts`)}`);
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
        this.log(`    ${chalk.bold('Subtotal')}${' '.repeat(22)}${this.colorCurrency(typeTotal)}`);
        this.log('');
      }

      // This Period Section
      this.log(chalk.dim('  ─────────────────────────────────────────────'));
      // Calculate days in range for display
      const daysInRange = Math.ceil((endParsed.getTime() - startParsed.getTime()) / (1000 * 60 * 60 * 24));
      const periodLabel = daysInRange === 1 ? '1 day' : `${daysInRange} days`;
      this.log(chalk.bold(`  THIS PERIOD`) + chalk.dim(` (${sinceDate} to ${untilDate}, ${periodLabel})`));
      this.log('');
      if (flags.compare) {
        const incomeChange = this.formatChange(income, prevIncome, false);
        const spendingChange = this.formatChange(Math.abs(spending), Math.abs(prevSpending), true);
        const netChange = this.formatChange(income + spending, prevIncome + prevSpending, false);
        this.log(`  Income:    ${this.colorCurrency(income)}  ${incomeChange}`);
        this.log(`  Spending:  ${this.colorCurrency(spending)}  ${spendingChange}`);
        this.log(`  Net:       ${this.colorCurrency(income + spending)}  ${netChange}`);
      } else {
        this.log(`  Income:    ${this.colorCurrency(income)}`);
        this.log(`  Spending:  ${this.colorCurrency(spending)}`);
        this.log(`  Net:       ${this.colorCurrency(income + spending)}`);
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

      // Top Spending Categories
      if (topCategories.length > 0) {
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
        this.log(chalk.dim('  ─────────────────────────────────────────────'));
        this.log(chalk.bold('  PENDING'));
        this.log(`  ${pendingTransactions.length} transactions (${formatCurrency(pendingTotal)})`);
        this.log('');
      }

      // Recent Activity (last 5 transactions)
      const recentTransactions = formattedTransactions
        .sort((a: FormattedTransaction, b: FormattedTransaction) => b.date.getTime() - a.date.getTime())
        .slice(0, 5);

      if (recentTransactions.length > 0) {
        this.log(chalk.dim('  ─────────────────────────────────────────────'));
        this.log(chalk.bold('  RECENT ACTIVITY'));
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
        this.log(chalk.dim('  ─────────────────────────────────────────────'));
        this.log(chalk.dim('  CACHE STATUS'));
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
