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
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Accounts);

    const format = flags.format ?? getConfig('format') ?? 'json';
    const typeFilter = flags.type?.toLowerCase();

    try {
      const accounts = (await listAccounts()).map(account => ({
        name: account.name,
        balance: account.balance?.current ?? 0,
        account_number: account.formatted_account,
        type: account.type,
        institution: account.connection.name,
      }));

      let filteredAccounts = accounts;

      if (args.account) {
        filteredAccounts = filteredAccounts.filter(account =>
          account.account_number === args.account ||
          account.name.toLowerCase().includes(args.account?.toLowerCase() ?? '')
        );
      }

      if (typeFilter) {
        filteredAccounts = filteredAccounts.filter(account =>
          account.type.toLowerCase().includes(typeFilter)
        );
      }

      // Group by account type
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
      const sortedAccounts = Object.values(groupedAccounts).flat();

      if (sortedAccounts.length > 0) {
        formatOutput(sortedAccounts, format);
      } else {
        this.error('No accounts found matching your criteria.');
      }

    } catch (error: any) {
      this.error(`Error fetching accounts: ${error.message}`);
    }
  }
}