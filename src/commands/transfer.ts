import { Command, Flags } from '@oclif/core';
import { Account } from 'akahu';
import ora from "ora";
import chalk from 'chalk';
import inquirer from 'inquirer';

import { apiService } from '../services/api.service.js';
import { configService } from '../services/config.service.js';
import { cacheService } from '../services/cache.service.js';
import { DEFAULT_TRANSFER_MAX_AMOUNT, NZ_ACCOUNT_PATTERN } from '../constants/index.js';
import { getErrorMessage } from '../utils/error.js';
import { warnIfConfigCorrupted } from '../utils/flags.js';
import { maskSensitiveValue, maskAccountNumber } from '../utils/mask.js';
import { formatCurrency } from '../utils/output.js';

/**
 * Validates NZ bank account number format.
 * Format: BB-bbbb-AAAAAAA-SSS where:
 * - BB: Bank code (2 digits)
 * - bbbb: Branch code (4 digits)
 * - AAAAAAA: Account number (7 digits, may have leading zeros)
 * - SSS: Suffix (2-3 digits)
 */
function isValidNZAccountNumber(accountNumber: string): boolean {
  return NZ_ACCOUNT_PATTERN.test(accountNumber);
}

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

    warnIfConfigCorrupted(this);

    // Safety check: Either --confirm or --dry-run must be provided
    if (!flags.confirm && !flags['dry-run']) {
      this.error(
        chalk.red('SAFETY REQUIRED: Transfer commands require either --confirm or --dry-run flag.\n') +
        chalk.yellow('Use --dry-run to preview the transfer without executing it.\n') +
        chalk.yellow('Use --confirm to execute the transfer after reviewing the summary.\n') +
        chalk.gray('Example: bank transfer --from "My Account" --to 12-3456-7890123-00 --amount 100.00 --confirm')
      );
    }

    let fromAccountId = flags.from;
    const amountStr = flags.amount;
    const description = flags.description;
    const reference = flags.reference;

    // Validate destination account number format (NZ bank account: XX-XXXX-XXXXXXX-XX)
    if (!isValidNZAccountNumber(flags.to)) {
      this.error(
        chalk.red('Invalid destination account number format.\n') +
        chalk.yellow('NZ bank accounts must be in the format: BB-bbbb-AAAAAAA-SS\n') +
        chalk.gray('  BB:      Bank code (2 digits)\n') +
        chalk.gray('  bbbb:    Branch code (4 digits)\n') +
        chalk.gray('  AAAAAAA: Account number (7 digits)\n') +
        chalk.gray('  SS:      Suffix (2-3 digits)\n') +
        chalk.gray('Example: 12-3456-0123456-00')
      );
    }

    // Validate amount format: must be a valid decimal number (no scientific notation)
    // Pattern: optional leading digits, optional decimal with 0-2 digits
    const validAmountPattern = /^\d+(\.\d{1,2})?$/;
    if (!validAmountPattern.test(amountStr)) {
      this.error(
        'Invalid amount format. Use a number with up to 2 decimal places (e.g., "100" or "99.50").'
      );
    }

    // Parse and validate the amount
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.error('Invalid amount. Please enter a positive number.');
    }

    // Warn on unusually large transfers (configurable via transferMaxAmount)
    const maxAmount = configService.get<number>('transferMaxAmount') ?? DEFAULT_TRANSFER_MAX_AMOUNT;
    if (amount > maxAmount) {
      this.error(
        chalk.red(`Amount ${formatCurrency(amount)} exceeds the configured maximum of ${formatCurrency(maxAmount)}.\n`) +
        chalk.gray(`To increase this limit: bank settings set transferMaxAmount ${amount}`)
      );
    }

    try {
      // Resolve source account
      const { resolvedAccountId: fromResolvedId, account: fromAccount } = await this.resolveAccount(flags.from);
      fromAccountId = fromResolvedId;

      // Safety check: Prevent transferring to the same account
      if (fromAccount.formatted_account === flags.to) {
        this.error(
          chalk.red('Source and destination accounts are identical.\n') +
          chalk.yellow('Cannot transfer funds to the same account.')
        );
      }

      // Check destination account allowlist if configured
      const allowedDestinations = configService.get<string[]>('transferAllowlist') || [];
      if (allowedDestinations.length > 0 && !allowedDestinations.includes(flags.to)) {
        this.error(
          chalk.red('Destination account not in allowlist.\n') +
          chalk.yellow(`Allowed destinations: ${allowedDestinations.join(', ')}\n`) +
          chalk.gray('Update allowlist with: bank settings set transferAllowlist "12-3456-7890123-00,98-7654-3210987-00"')
        );
      }

      // Create transfer summary
      const transferSummary: TransferSummary = {
        fromAccount: {
          id: maskSensitiveValue(fromAccountId),
          name: fromAccount.name,
          maskedNumber: maskAccountNumber(fromAccount.formatted_account || fromAccount.name),
        },
        toAccount: maskAccountNumber(flags.to),
        amount,
        description,
        reference,
      };

      // Display transfer summary
      this.displayTransferSummary(transferSummary);

      // Handle dry-run mode
      if (flags['dry-run']) {
        this.log(chalk.blue('\n[DRY RUN] No transfer will be executed'));
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
      this.log(chalk.blue('\nExecuting transfer...'));
      await this.executeTransfer({
        fromAccountId,
        toAccountId: flags.to,
        amount,
        description,
        reference,
      });

    } catch (error) {
      // Redact sensitive information from error logs
      const sanitizedError = this.sanitizeErrorMessage(getErrorMessage(error));
      this.error(`Error processing transfer: ${sanitizedError}`);
    }
  }

  private async resolveAccount(accountIdentifier: string): Promise<{ resolvedAccountId: string; account: Account }> {
    // Use cache service to avoid unnecessary API calls
    const cacheEnabled = configService.get<boolean>('cacheData') ?? false;
    const { accounts } = await cacheService.getAccountsWithCache(
      false, // don't force refresh
      cacheEnabled,
      () => apiService.listAccounts()
    );

    if (accountIdentifier.startsWith('acc_')) {
      // It's already an account ID, find the account details
      const account = accounts.find((acc: Account) => acc._id === accountIdentifier);
      if (!account) {
        throw new Error(`Account with ID '${accountIdentifier}' not found.`);
      }
      return { resolvedAccountId: accountIdentifier, account };
    } else {
      // It's an account name, find the matching account
      const matchedAccount = accounts.find((acc: Account) =>
        acc.name.toLowerCase() === accountIdentifier.toLowerCase()
      );

      if (!matchedAccount) {
        throw new Error(`Account with name '${accountIdentifier}' not found.`);
      }
      return { resolvedAccountId: matchedAccount._id, account: matchedAccount };
    }
  }

  private displayTransferSummary(summary: TransferSummary): void {
    this.log(chalk.bold('\nTRANSFER SUMMARY'));
    this.log(chalk.gray('-'.repeat(50)));
    this.log(`${chalk.bold('From:')} ${summary.fromAccount.name} (${summary.fromAccount.maskedNumber})`);
    this.log(`${chalk.bold('To:')} ${summary.toAccount}`);
    this.log(`${chalk.bold('Amount:')} ${chalk.green(`${formatCurrency(summary.amount)} NZD`)}`);
    
    if (summary.description) {
      this.log(`${chalk.bold('Description:')} ${summary.description}`);
    }
    if (summary.reference) {
      this.log(`${chalk.bold('Reference:')} ${summary.reference}`);
    }
    this.log(chalk.gray('-'.repeat(50)));
  }

  private async confirmTransfer(): Promise<boolean> {
    const response = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: chalk.red('WARNING: Are you sure you want to execute this transfer? This action cannot be undone.'),
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

    // Monitor transfer status with timeout and error handling
    let transferResponse = await apiService.getTransferStatus(transferId);
    const spinner = ora('Transfer is pending...').start();

    const MAX_POLL_ATTEMPTS = 30; // 30 attempts * 2 seconds = 60 seconds max
    const POLL_INTERVAL_MS = 2000;
    const TERMINAL_STATUSES = ['SENT', 'DECLINED', 'ERROR', 'PAUSED'];
    let attempts = 0;

    while (!TERMINAL_STATUSES.includes(transferResponse.status)) {
      attempts++;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        spinner.stop();
        const timeoutSeconds = (MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000;
        this.log(chalk.yellow(`\nTransfer is still processing after ${timeoutSeconds} seconds.`));
        this.log(chalk.blue('This does NOT mean the transfer failed.'));
        this.log(chalk.gray(`Current status: ${transferResponse.status}`));
        this.log(chalk.gray(`Transfer ID: ${maskSensitiveValue(transferId)}`));
        this.log(chalk.gray('\nThe transfer is likely still in progress. Bank transfers can take'));
        this.log(chalk.gray('several minutes to complete. Check your bank app or wait for'));
        this.log(chalk.gray('confirmation from your bank.'));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      transferResponse = await apiService.getTransferStatus(transferId);
    }

    spinner.stop();

    if (transferResponse.status === 'SENT') {
      this.log(chalk.green('Transfer completed successfully.'));
    } else if (transferResponse.status === 'DECLINED') {
      this.log(chalk.red('Transfer was declined by the bank.'));
    } else if (transferResponse.status === 'ERROR') {
      this.log(chalk.red('Transfer encountered an error.'));
    } else if (transferResponse.status === 'PAUSED') {
      this.log(chalk.yellow('Transfer is paused and requires attention.'));
    }

    this.log(chalk.gray(`Transfer ID: ${maskSensitiveValue(transferId)}`));
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove or mask potential sensitive information from error messages
    // Use same masking pattern as maskAccountNumber for consistency
    return message
      .replace(/acc_[a-zA-Z0-9]+/g, 'acc_****')
      .replace(/(\d{2})-\d{4}-\d{7}-(\d{2,3})/g, '$1-****-*******-$2')
      .replace(/\$[\d,]+\.?\d*/g, '$***.**');
  }
}