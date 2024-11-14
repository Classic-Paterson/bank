import { Command, Flags } from '@oclif/core';
import { initiateTransfer } from '../utils/api.js';
import { listAccounts, getTransferStatus } from '../utils/api.js';
import ora from "ora";

export default class Transfer extends Command {
  static description = 'Initiate a funds transfer';

  static examples = [
    '$ bank transfer --from "Everyday Checking" --to 12-3456-7890123-00 --amount 100.00',
    '$ bank transfer --from acc_12345 --to 12-3456-7890123-00 --amount 100.00 --description "Payment for services" --reference "Invoice 123"',
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
  };

  async run() {
    const { flags } = await this.parse(Transfer);

    let fromAccountId = flags.from;
    let toAccountId = flags.to;
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
      // Check if 'from' is an account ID or name
      if (!fromAccountId.startsWith('acc_')) {
        // Assume it's an account name; attempt to find the matching account ID
        const accounts = await listAccounts();

        const matchedAccount = accounts.find(account =>
          account.name.toLowerCase() === fromAccountId.toLowerCase()
        );

        if (matchedAccount) {
          fromAccountId = matchedAccount._id; // Use the account ID from the matched account
        } else {
          this.error(`Account with name '${fromAccountId}' not found.`);
          return;
        }
      }

      // Check if 'to' is an account ID or name
      if (!toAccountId.startsWith('acc_')) {
        // Assume it's an account name; attempt to find the matching account ID
        const accounts = await listAccounts();

        const matchedAccount = accounts.find(account =>
          account.name.toLowerCase() === toAccountId.toLowerCase()
        );

        if (matchedAccount) {
          toAccountId = matchedAccount._id; // Use the account ID from the matched account
        } else {
          this.error(`Account with name '${toAccountId}' not found.`);
          return;
        }
      }

      this.log(`Initiating transfer of $${amount.toFixed(2)} from account ${fromAccountId} to ${toAccountId}...`);

      const transferId = await initiateTransfer({
        fromAccountId,
        toAccountId,
        amount,
        description,
        reference,
      });

      // check the status of the transfer and keep it loading until it is completed
      let transferResponse = await getTransferStatus(transferId);
      const spinner = ora('Transfer is still pending...').start();

      while (transferResponse.status !== "SENT") {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds
        transferResponse = await getTransferStatus(transferId);

      }
      spinner.stop();
      this.log('Transfer completed successfully.');
    } catch (error: any) {
      this.error(`Error initiating transfer: ${error.message}`);
    }
  }
}