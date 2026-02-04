import { Command } from '@oclif/core';

export default class Cache extends Command {
  static description = 'Manage local cache for accounts and transactions';

  static hidden = true;

  static strict = false;

  async run(): Promise<void> {
    const args = this.argv;

    if (args.length === 0) {
      await this.config.runCommand('help', ['cache']);
      return;
    }

    const subcommand = args[0];
    const commandId = `cache:${subcommand}`;
    const remainingArgs = args.slice(1);

    // Check if command exists
    const command = this.config.findCommand(commandId);
    if (!command) {
      this.error(`Unknown subcommand: ${subcommand}\nRun "bank cache --help" to see available subcommands.`);
    }

    await this.config.runCommand(commandId, remainingArgs);
  }
}
