import { Command, Flags } from '@oclif/core';
import { Account } from 'akahu';
import ora from "ora";
import chalk from 'chalk';
import inquirer from 'inquirer';

import { apiService } from '../services/api.service.js';
import { configService } from '../services/config.service.js';

interface TransferSummary {
  fromAccount: {
    id: string;
    name: string;
    maskedNumber: string;
  };
  toAccount: string;
  amount: number;
  description?: string;
  reference?: string;
}

export default class Transfer extends Command {
  static description = 'Initiate a funds transfer with safety features';

  static examples = [
    '$ bank transfer --from "Everyday Checking" --to 12-3456-7890123-00 --amount 100.00 --confirm',
    '$ bank transfer --from acc_12345 --to 12-3456-7890123-00 --amount 100.00 --description "Payment" --reference "Invoice 123" --confirm',
    '$ bank transfer --from acc_12345 --to 12-3456-7890123-00 --amount 100.00 --dry-run',
  ];

  static flags = {
    from: Flags.string({
      char: 'f',
      description: 'Source account ID or name',
      required: true,
    }),
    to: Flags.string({
      char: 't',
      description: 'Destination account number (e.g., 12-3456-7890123-00)',
      required: true,
    }),
    amount: Flags.string({
      char: 'a',
      description: 'Amount to transfer (in NZD)',
      required: true,
    }),
    description: Flags.string({
      char: 'd',
      description: 'Transfer description',
    }),
    reference: Flags.string({
      char: 'r',
      description: 'Transfer reference',
    }),
    confirm: Flags.boolean({
      char: 'c',
      description: 'Confirm the transfer after reviewing the summary (REQUIRED for actual transfers)',
      required: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Show transfer summary without executing (overrides --confirm)',
      required: false,
    }),
  };

  async run() {
    const { flags } = await this.parse(Transfer);

    // Safety check: Either --confirm or --dry-run must be provided
    if (!flags.confirm && !flags['dry-run']) {
      this.error(
        chalk.red('⚠️  SAFETY REQUIRED: Transfer commands require either --confirm or --dry-run flag.\n') +
        chalk.yellow('Use --dry-run to preview the transfer without executing it.\n') +
        chalk.yellow('Use --confirm to execute the transfer after reviewing the summary.\n') +
        chalk.gray('Example: bank transfer --from "My Account" --to 12-3456-7890123-00 --amount 100.00 --confirm')
      );
      return;
    }

    let fromAccountId = flags.from;
    const amountStr = flags.amount;
    const description = flags.description;
    const reference = flags.reference;

    // Parse and validate the amount
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      this.error('Invalid amount. Please enter a positive number.');
      return;
    }

    try {
      // Resolve source account
      const { resolvedAccountId: fromResolvedId, account: fromAccount } = await this.resolveAccount(flags.from);
      fromAccountId = fromResolvedId;

      // Check destination account allowlist if configured
      const allowedDestinations = configService.get<string[]>('transferAllowlist') || [];
      if (allowedDestinations.length > 0 && !allowedDestinations.includes(flags.to)) {
        this.error(
          chalk.red('⚠️  Destination account not in allowlist.\n') +
          chalk.yellow(`Allowed destinations: ${allowedDestinations.join(', ')}\n`) +
          chalk.gray('Update allowlist with: bank settings set transferAllowlist "12-3456-7890123-00,98-7654-3210987-00"')
        );
        return;
      }

      // Create transfer summary
      const transferSummary: TransferSummary = {
        fromAccount: {
          id: this.maskSensitiveData(fromAccountId),
          name: fromAccount.name,
          maskedNumber: this.maskAccountNumber(fromAccount.formatted_account || fromAccount.name),
        },
        toAccount: this.maskAccountNumber(flags.to),
        amount,
        description,
        reference,
      };

      // Display transfer summary
      this.displayTransferSummary(transferSummary);

      // Handle dry-run mode
      if (flags['dry-run']) {
        this.log(chalk.blue('\n🔍 DRY RUN MODE - No transfer will be executed'));
        this.log(chalk.gray('To execute this transfer, run the same command with --confirm instead of --dry-run'));
        return;
      }

      // Confirm transfer execution
      const shouldProceed = await this.confirmTransfer();
      if (!shouldProceed) {
        this.log(chalk.yellow('Transfer cancelled by user.'));
        return;
      }

      // Execute transfer
      this.log(chalk.blue('\n💸 Executing transfer...'));
      await this.executeTransfer({
        fromAccountId,
        toAccountId: flags.to,
        amount,
        description,
        reference,
      });

    } catch (error: any) {
      // Redact sensitive information from error logs
      const sanitizedError = this.sanitizeErrorMessage(error.message);
      this.error(`Error processing transfer: ${sanitizedError}`);
    }
  }

  private async resolveAccount(accountIdentifier: string): Promise<{ resolvedAccountId: string; account: Account }> {
    if (accountIdentifier.startsWith('acc_')) {
      // It's already an account ID, find the account details
      const accounts = await apiService.listAccounts();
      const account = accounts.find((acc: Account) => acc._id === accountIdentifier);
      if (!account) {
        throw new Error(`Account with ID '${accountIdentifier}' not found.`);
      }
      return { resolvedAccountId: accountIdentifier, account };
    } else {
      // It's an account name, find the matching account
      const accounts = await apiService.listAccounts();
      const matchedAccount = accounts.find((account: Account) =>
        account.name.toLowerCase() === accountIdentifier.toLowerCase()
      );

      if (!matchedAccount) {
        throw new Error(`Account with name '${accountIdentifier}' not found.`);
      }
      return { resolvedAccountId: matchedAccount._id, account: matchedAccount };
    }
  }

  private displayTransferSummary(summary: TransferSummary): void {
    this.log(chalk.bold('\n📋 TRANSFER SUMMARY'));
    this.log(chalk.gray('━'.repeat(50)));
    this.log(`${chalk.bold('From:')} ${summary.fromAccount.name} (${summary.fromAccount.maskedNumber})`);
    this.log(`${chalk.bold('To:')} ${summary.toAccount}`);
    this.log(`${chalk.bold('Amount:')} ${chalk.green(`$${summary.amount.toFixed(2)} NZD`)}`);
    
    if (summary.description) {
      this.log(`${chalk.bold('Description:')} ${summary.description}`);
    }
    if (summary.reference) {
      this.log(`${chalk.bold('Reference:')} ${summary.reference}`);
    }
    this.log(chalk.gray('━'.repeat(50)));
  }

  private async confirmTransfer(): Promise<boolean> {
    const response = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: chalk.red('⚠️  Are you sure you want to execute this transfer? This action cannot be undone.'),
        default: false,
      },
    ]);
    return response.proceed;
  }

  private async executeTransfer(params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    reference?: string;
  }): Promise<void> {
    const transferId = await apiService.initiateTransfer(params);

    // Monitor transfer status
    let transferResponse = await apiService.getTransferStatus(transferId);
    const spinner = ora('Transfer is pending...').start();

    while (transferResponse.status !== "SENT") {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds
      transferResponse = await apiService.getTransferStatus(transferId);
    }
    
    spinner.stop();
    this.log(chalk.green('✅ Transfer completed successfully.'));
    this.log(chalk.gray(`Transfer ID: ${this.maskSensitiveData(transferId)}`));
  }

  private maskSensitiveData(data: string): string {
    if (data.length <= 8) {
      return '*'.repeat(data.length);
    }
    return `${data.substring(0, 4)}${'*'.repeat(data.length - 8)}${data.substring(data.length - 4)}`;
  }

  private maskAccountNumber(accountNumber: string): string {
    // Handle NZ bank account format (XX-XXXX-XXXXXXX-XX)
    const parts = accountNumber.split('-');
    if (parts.length === 4) {
      return `${parts[0]}-****-****${parts[2].substring(parts[2].length - 3)}-${parts[3]}`;
    }
    // Fallback for other formats
    return this.maskSensitiveData(accountNumber);
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove or mask potential sensitive information from error messages
    return message
      .replace(/acc_[a-zA-Z0-9]+/g, 'acc_****')
      .replace(/\d{2}-\d{4}-\d{7}-\d{2}/g, '**-****-*****-**')
      .replace(/\$[\d,]+\.?\d*/g, '$***.**');
  }
}