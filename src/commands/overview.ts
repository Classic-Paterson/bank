import { Command } from '@oclif/core';
import { Account } from 'akahu';
import chalk from 'chalk';

import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { FormattedTransaction } from '../types/index.js';
import { isExcludedTransactionType, DEFAULT_OVERVIEW_DAYS_BACK } from '../constants/index.js';
import { formatRelativeTime, formatCurrency } from '../utils/output.js';
import { getErrorMessage } from '../utils/error.js';
import { parseDateRange } from '../utils/date.js';
import { refreshFlag, quietFlag, dateFilterFlags, warnIfConfigCorrupted, isCacheEnabled } from '../utils/flags.js';

export default class Overview extends Command {
  static description = 'Display a financial dashboard with account balances, spending summary, and recent activity';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --days 30',
    '<%= config.bin %> <%= command.id %> --since 2024-01-01 --until 2024-01-31',
    '<%= config.bin %> <%= command.id %> --refresh',
  ];

  static override flags = {
    ...dateFilterFlags(DEFAULT_OVERVIEW_DAYS_BACK),
    refresh: refreshFlag,
    quiet: quietFlag,
  };

  /**
   * Apply chalk coloring to a formatted currency string.
   * Green for positive, red for negative.
   */
  private colorCurrency(amount: number): string {
    const formatted = formatCurrency(amount);
    return amount < 0 ? chalk.red(formatted) : chalk.green(formatted);
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
      const accounts = accResult.accounts;

      // Fetch transactions with caching
      const txResult = await cacheService.getTransactionsWithCache(
        sinceDate,
        untilDate,
        flags.refresh,
        cacheEnabled,
        () => apiService.listAllTransactions(sinceDate, untilDate)
      );
      const transactions = txResult.transactions;
      const fromCache = accResult.fromCache || txResult.fromCache;

      // Format transactions for analysis
      const formattedTransactions = transactionProcessingService.formatTransactions(transactions, accounts);

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
          const category = tx.parentCategory || 'Uncategorized';
          acc[category] = (acc[category] || 0) + Math.abs(tx.amount);
          return acc;
        }, {});

      const topCategories = Object.entries(categorySpending)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      // Get cache info
      const cacheInfo = cacheService.getCacheInfo();

      // ═══════════════════════════════════════════════════════════════
      // DISPLAY OUTPUT
      // ═══════════════════════════════════════════════════════════════

      this.log('');
      this.log(chalk.bold('  FINANCIAL OVERVIEW'));
      this.log(chalk.dim('  ─────────────────────────────────────────────'));

      if (fromCache && !flags.quiet) {
        this.log(chalk.dim('  (using cached data)'));
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
      this.log(`  Income:    ${this.colorCurrency(income)}`);
      this.log(`  Spending:  ${this.colorCurrency(spending)}`);
      this.log(`  Net:       ${this.colorCurrency(income + spending)}`);
      this.log('');

      // Top Spending Categories
      if (topCategories.length > 0) {
        this.log(chalk.bold('  TOP SPENDING'));
        const maxSpend = topCategories[0]?.[1] ?? 0;
        for (const [category, amount] of topCategories) {
          const barLength = Math.round((amount / maxSpend) * 20);
          const bar = chalk.red('█'.repeat(barLength)) + chalk.dim('░'.repeat(20 - barLength));
          const amountStr = `$${amount.toFixed(0)}`.padStart(8);
          this.log(`  ${bar} ${amountStr}  ${category}`);
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
