import { Args, Command, Flags } from '@oclif/core';
import { formatOutput } from '../utils/output.js';
import { listAccounts } from '../utils/api.js';
import { getConfig } from '../utils/config.js';

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
  ];

  static override flags = {
    format: Flags.string({
      char: 'f',
      description: 'Output format (json, csv, table)',
      options: ['json', 'csv', 'table'],
    }),
    type: Flags.string({
      char: 't',
      description: 'Account type to filter (loan, checking, savings, etc.)',
    }),
    details: Flags.boolean({
      char: 'd',
      description: 'Show detailed account info',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Accounts);

    const format = flags.format ?? getConfig('format') ?? 'json';
    const typeFilter = flags.type?.toLowerCase();

    try {
      const rawAccounts = await listAccounts();

      // Map accounts based on the details flag
      const accounts = flags.details
        ? rawAccounts.map(account => ({
            id: account._id,
            accountNumber: account.formatted_account,
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
        : rawAccounts.map(account => ({
            accountNumber: account.formatted_account,
            name: account.name,
            type: account.type,
            institution: account.connection.name,
            balance: account.balance?.current ?? 0,
          }));

      let filteredAccounts = accounts;

      if (args.account) {
        filteredAccounts = filteredAccounts.filter(account =>
          account.accountNumber === args.account ||
          account.name.toLowerCase().includes(args.account?.toLowerCase() ?? '')
        );
      }

      if (typeFilter) {
        filteredAccounts = filteredAccounts.filter(account =>
          account.type.toLowerCase().includes(typeFilter)
        );
      }

      // Group by account type only when not showing detailed info
      // (Grouping helps provide a more organized summary for the basic view.)
      let sortedAccounts = filteredAccounts;
      if (!flags.details) {
        const groupedAccounts = filteredAccounts.reduce((groups, account) => {
          const type = account.type;
          if (!groups[type]) {
            groups[type] = [];
          }
          groups[type].push(account);
          return groups;
        }, {} as Record<string, typeof filteredAccounts>);

        // Sort each group by balance in descending order
        for (const type in groupedAccounts) {
          groupedAccounts[type].sort((a, b) => b.balance - a.balance);
        }

        // Flatten the grouped and sorted accounts for output
        sortedAccounts = Object.values(groupedAccounts).flat();
      }

      if (sortedAccounts.length > 0) {
        formatOutput(sortedAccounts, format);

        if (format.toLowerCase() === 'table') {
          const totalAccounts = sortedAccounts.length;
          const totalBalance = sortedAccounts.reduce((sum, acc) => sum + acc.balance, 0);
          console.log(`\nSummary: Total Accounts: ${totalAccounts} | Total Balance: $${totalBalance.toFixed(2)}\n`);
        }
      } else {
        this.error('No accounts found matching your criteria.');
      }

    } catch (error: any) {
      this.error(`Error fetching accounts: ${error.message}`);
    }
  }
}