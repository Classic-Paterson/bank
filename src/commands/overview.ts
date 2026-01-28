import { Command, Flags } from '@oclif/core';
import { Account, EnrichedTransaction } from 'akahu';
import chalk from 'chalk';

import { apiService } from '../services/api.service.js';
import { configService } from '../services/config.service.js';
import { cacheService } from '../services/cache.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { FormattedTransaction, AccountSummary } from '../types/index.js';
import { EXCLUDED_TRANSACTION_TYPES } from '../constants/index.js';

export default class Overview extends Command {
  static description = 'Display a financial dashboard with account balances, spending summary, and recent activity';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --days 30',
    '<%= config.bin %> <%= command.id %> --refresh',
  ];

  static override flags = {
    days: Flags.integer({
      char: 'd',
      description: 'Number of days to include in spending analysis',
      default: 30,
    }),
    refresh: Flags.boolean({
      char: 'r',
      description: 'Force refresh from API (bypass cache)',
      default: false,
    }),
  };

  private formatCurrency(amount: number): string {
    const formatted = Math.abs(amount).toLocaleString('en-NZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return amount < 0 ? chalk.red(`-$${formatted}`) : chalk.green(`$${formatted}`);
  }

  private formatCurrencyPlain(amount: number): string {
    const formatted = Math.abs(amount).toLocaleString('en-NZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return amount < 0 ? `-$${formatted}` : `$${formatted}`;
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    return `${diffDays}d ago`;
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Overview);
    const cacheEnabled = configService.get<boolean>('cacheData') ?? false;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - flags.days);

    const sinceDate = startDate.toISOString().split('T')[0];
    const untilDate = endDate.toISOString().split('T')[0];

    try {
      let accounts: Account[];
      let transactions: EnrichedTransaction[];
      let fromCache = false;

      // Fetch accounts
      if (cacheEnabled && !flags.refresh && cacheService.isAccountCacheValid()) {
        const cachedAccounts = cacheService.getCachedAccounts();
        accounts = cachedAccounts.map((acc: AccountSummary) => ({
          _id: acc.id ?? '',
          name: acc.name,
          formatted_account: acc.accountNumber,
          type: acc.type,
          connection: { name: acc.institution },
          balance: { current: acc.balance, available: acc.availableBalance },
        })) as unknown as Account[];
        fromCache = true;
      } else {
        accounts = await apiService.listAccounts();
        if (cacheEnabled) {
          cacheService.setAccountCache(accounts);
        }
      }

      // Fetch transactions
      if (cacheEnabled && !flags.refresh && cacheService.isTransactionCacheValid(sinceDate, untilDate)) {
        transactions = cacheService.getCachedTransactions(sinceDate, untilDate);
        fromCache = true;
      } else {
        transactions = await apiService.listAllTransactions(sinceDate, untilDate);
        if (cacheEnabled) {
          cacheService.setTransactionCache(transactions);
        }
      }

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
          !EXCLUDED_TRANSACTION_TYPES.includes(tx.type as any)
        )
        .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

      // Calculate income (positive amounts, excluding transfers)
      const income = formattedTransactions
        .filter((tx: FormattedTransaction) =>
          tx.amount > 0 &&
          !EXCLUDED_TRANSACTION_TYPES.includes(tx.type as any)
        )
        .reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);

      // Get pending transactions (transactions without a settled date are pending)
      const pendingTransactions = transactions.filter(tx => !tx.date);
      const pendingTotal = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      // Category breakdown (top 5 spending categories)
      const categorySpending = formattedTransactions
        .filter((tx: FormattedTransaction) =>
          tx.amount < 0 &&
          !EXCLUDED_TRANSACTION_TYPES.includes(tx.type as any) &&
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

      console.log('');
      console.log(chalk.bold('  FINANCIAL OVERVIEW'));
      console.log(chalk.dim('  ─────────────────────────────────────────────'));

      if (fromCache) {
        console.log(chalk.dim('  (using cached data)'));
      }
      console.log('');

      // Net Worth Section
      console.log(chalk.bold('  NET WORTH'));
      console.log(`  ${this.formatCurrency(totalBalance)} ${chalk.dim(`across ${accountCount} accounts`)}`);
      console.log('');

      // Account breakdown by type
      for (const [type, accs] of Object.entries(accountsByType)) {
        const typeTotal = accs.reduce((sum, acc) => sum + (acc.balance?.current ?? 0), 0);
        console.log(chalk.dim(`  ${type.toUpperCase()}`));
        for (const acc of accs.sort((a, b) => (b.balance?.current ?? 0) - (a.balance?.current ?? 0))) {
          const balance = acc.balance?.current ?? 0;
          const balanceStr = this.formatCurrencyPlain(balance);
          const padding = ' '.repeat(Math.max(1, 30 - acc.name.length));
          console.log(`    ${acc.name}${padding}${balance >= 0 ? chalk.green(balanceStr) : chalk.red(balanceStr)}`);
        }
        console.log(chalk.dim(`    ${'─'.repeat(38)}`));
        console.log(`    ${chalk.bold('Subtotal')}${' '.repeat(22)}${this.formatCurrency(typeTotal)}`);
        console.log('');
      }

      // This Period Section
      console.log(chalk.dim('  ─────────────────────────────────────────────'));
      console.log(chalk.bold(`  THIS PERIOD`) + chalk.dim(` (last ${flags.days} days)`));
      console.log('');
      console.log(`  Income:    ${this.formatCurrency(income)}`);
      console.log(`  Spending:  ${this.formatCurrency(spending)}`);
      console.log(`  Net:       ${this.formatCurrency(income + spending)}`);
      console.log('');

      // Top Spending Categories
      if (topCategories.length > 0) {
        console.log(chalk.bold('  TOP SPENDING'));
        const maxSpend = topCategories[0]?.[1] ?? 0;
        for (const [category, amount] of topCategories) {
          const barLength = Math.round((amount / maxSpend) * 20);
          const bar = chalk.red('█'.repeat(barLength)) + chalk.dim('░'.repeat(20 - barLength));
          const amountStr = `$${amount.toFixed(0)}`.padStart(8);
          console.log(`  ${bar} ${amountStr}  ${category}`);
        }
        console.log('');
      }

      // Pending Transactions
      if (pendingTransactions.length > 0) {
        console.log(chalk.dim('  ─────────────────────────────────────────────'));
        console.log(chalk.bold('  PENDING'));
        console.log(`  ${pendingTransactions.length} transactions (${this.formatCurrencyPlain(pendingTotal)})`);
        console.log('');
      }

      // Recent Activity (last 5 transactions)
      const recentTransactions = formattedTransactions
        .sort((a: FormattedTransaction, b: FormattedTransaction) => b.date.getTime() - a.date.getTime())
        .slice(0, 5);

      if (recentTransactions.length > 0) {
        console.log(chalk.dim('  ─────────────────────────────────────────────'));
        console.log(chalk.bold('  RECENT ACTIVITY'));
        for (const tx of recentTransactions) {
          const timeAgo = this.getRelativeTime(tx.date);
          const desc = tx.merchant || tx.description;
          const truncatedDesc = desc.length > 25 ? desc.substring(0, 22) + '...' : desc;
          const padding = ' '.repeat(Math.max(1, 26 - truncatedDesc.length));
          const amountStr = this.formatCurrencyPlain(tx.amount);
          console.log(`  ${chalk.dim(timeAgo.padEnd(12))}${truncatedDesc}${padding}${tx.amount >= 0 ? chalk.green(amountStr) : chalk.red(amountStr)}`);
        }
        console.log('');
      }

      // Cache Status
      if (cacheEnabled) {
        console.log(chalk.dim('  ─────────────────────────────────────────────'));
        console.log(chalk.dim('  CACHE STATUS'));
        const txLastUpdate = cacheInfo.transactions.lastUpdate
          ? this.getRelativeTime(new Date(cacheInfo.transactions.lastUpdate))
          : 'never';
        const accLastUpdate = cacheInfo.accounts.lastUpdate
          ? this.getRelativeTime(new Date(cacheInfo.accounts.lastUpdate))
          : 'never';
        console.log(chalk.dim(`  Transactions: ${cacheInfo.transactions.count} cached (updated ${txLastUpdate})`));
        console.log(chalk.dim(`  Accounts: ${cacheInfo.accounts.count} cached (updated ${accLastUpdate})`));
        console.log('');
      }

    } catch (error: any) {
      this.error(`Error fetching data: ${error.message}`);
    }
  }
}
