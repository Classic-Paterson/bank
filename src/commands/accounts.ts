import { Args, Command, Flags } from '@oclif/core';
import { Account } from 'akahu';

import { formatOutput } from '../utils/output.js';
import { getErrorMessage } from '../utils/error.js';
import { refreshFlag, quietFlag, formatFlag, warnIfConfigCorrupted, resolveFormat, isCacheEnabled } from '../utils/flags.js';
import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { AccountSummary } from '../types/index.js';
import { NZD_DECIMAL_PLACES } from '../constants/index.js';

export default class Accounts extends Command {
  static description = 'View account information';

  static override args = {
    account: Args.string({ description: 'Account to filter' }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --format csv',
    '<%= config.bin %> <%= command.id %> --type savings',
    '<%= config.bin %> <%= command.id %> --details',
    '<%= config.bin %> <%= command.id %> --total  # Get total balance across all accounts',
    '<%= config.bin %> <%= command.id %> --type savings --total  # Get total savings balance',
  ];

  static override flags = {
    format: formatFlag,
    type: Flags.string({
      char: 't',
      description: 'Account type to filter (loan, checking, savings, etc.)',
    }),
    details: Flags.boolean({
      char: 'd',
      description: 'Show detailed account info',
      default: false,
    }),
    refresh: refreshFlag,
    quiet: quietFlag,
    total: Flags.boolean({
      description: 'Output only the total balance of matching accounts (useful for scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Accounts);

    warnIfConfigCorrupted(this, flags.quiet);

    // Resolve and validate format early (normalized to lowercase)
    const format = resolveFormat(flags.format);
    const typeFilter = flags.type?.toLowerCase();
    const cacheEnabled = isCacheEnabled();

    try {
      // Detailed view requires fresh API data (cache doesn't store full Account objects)
      const canUseCache = !flags.details;

      // Fetch accounts (from cache or API)
      const { accounts: rawAccounts, fromCache } = canUseCache
        ? await cacheService.getAccountsWithCache(
            flags.refresh,
            cacheEnabled,
            () => apiService.listAccounts()
          )
        : { accounts: await apiService.listAccounts(), fromCache: false };

      // Update cache if we fetched fresh data
      if (!fromCache && cacheEnabled) {
        cacheService.setAccountCache(rawAccounts);
      }

      if (fromCache && format === 'table' && !flags.quiet) {
        this.log('(using cached data)\n');
      }

      // Map accounts to display format
      const accounts: AccountSummary[] = flags.details
        ? rawAccounts.map((account: Account) => ({
            id: account._id,
            accountNumber: account.formatted_account ?? '',
            name: account.name,
            type: account.type,
            institution: account.connection.name,
            balance: account.balance?.current ?? 0,
            availableBalance: account.balance?.available ?? (account.balance?.current ?? 0),
            meta:
              account.type.toLowerCase() === 'loan'
                ? `Interest: ${account.meta?.loan_details?.interest?.rate ?? 'N/A'}%, Amount: $${Number(account.meta?.loan_details?.repayment?.next_amount ?? 0).toFixed(2)}, Due: ${new Date(account.meta?.loan_details?.repayment?.next_date ?? '').toLocaleDateString('en-GB')}`
                : account.type.toLowerCase() === 'kiwisaver'
                  ? `Returns: $${Number(account.meta?.breakdown?.returns ?? 0).toFixed(2)}`
                  : '',
          }))
        : rawAccounts.map((account: Account) => ({
            accountNumber: account.formatted_account ?? '',
            name: account.name,
            type: account.type,
            institution: account.connection.name,
            balance: account.balance?.current ?? 0,
          }));

      // Apply filters
      let filteredAccounts = accounts;

      if (args.account) {
        filteredAccounts = filteredAccounts.filter((account: AccountSummary) =>
          account.accountNumber === args.account ||
          account.name.toLowerCase().includes(args.account?.toLowerCase() ?? '')
        );
      }

      if (typeFilter) {
        filteredAccounts = filteredAccounts.filter((account: AccountSummary) =>
          account.type.toLowerCase().includes(typeFilter)
        );
      }

      // Group and sort by type (only for non-detailed view)
      let sortedAccounts = filteredAccounts;
      if (!flags.details) {
        const groupedAccounts = filteredAccounts.reduce((groups: Record<string, AccountSummary[]>, account: AccountSummary) => {
          const type = account.type;
          if (!groups[type]) {
            groups[type] = [];
          }
          groups[type].push(account);
          return groups;
        }, {} as Record<string, AccountSummary[]>);

        for (const type in groupedAccounts) {
          groupedAccounts[type].sort((a: AccountSummary, b: AccountSummary) => b.balance - a.balance);
        }

        sortedAccounts = Object.values(groupedAccounts).flat();
      }

      if (sortedAccounts.length === 0) {
        if (flags.total) {
          this.log('0.00');
        } else if (!flags.quiet) {
          // Build a helpful message showing what was searched
          const appliedFilters: string[] = [];
          if (args.account) appliedFilters.push(`account="${args.account}"`);
          if (typeFilter) appliedFilters.push(`type="${typeFilter}"`);

          this.log('No accounts found.');
          if (appliedFilters.length > 0) {
            this.log(`Filters: ${appliedFilters.join(', ')}`);
            this.log('');
            this.log('Tips:');
            this.log('  - Remove filters to see all accounts: bank accounts');
            this.log('  - Account types are case-insensitive (e.g., savings, checking, loan)');
          }
        }
        return;
      }

      // If --total flag is set, output only the sum of balances and exit
      if (flags.total) {
        const total = sortedAccounts.reduce((sum: number, acc: AccountSummary) => sum + acc.balance, 0);
        this.log(total.toFixed(NZD_DECIMAL_PLACES));
        return;
      }

      formatOutput(sortedAccounts, format);

      if (format === 'table' && !flags.quiet) {
        const totalAccounts = sortedAccounts.length;
        const totalBalance = sortedAccounts.reduce((sum: number, acc: AccountSummary) => sum + acc.balance, 0);
        this.log(`\nSummary: Total Accounts: ${totalAccounts} | Total Balance: $${totalBalance.toFixed(NZD_DECIMAL_PLACES)}\n`);
      }

    } catch (error) {
      this.error(`Error fetching accounts: ${getErrorMessage(error)}`);
    }
  }
}