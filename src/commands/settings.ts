import { Command } from '@oclif/core';

export default class Settings extends Command {
  static description = 'Configure CLI preferences';

  static hidden = true;

  static strict = false;

  async run(): Promise<void> {
    const args = this.argv;

    if (args.length === 0) {
      await this.config.runCommand('help', ['settings']);
      return;
    }

    const subcommand = args[0];
    const commandId = `settings:${subcommand}`;
    const remainingArgs = args.slice(1);

    // Check if command exists
    const command = this.config.findCommand(commandId);
    if (!command) {
      this.error(`Unknown subcommand: ${subcommand}\nRun "bank settings --help" to see available subcommands.`);
    }

    await this.config.runCommand(commandId, remainingArgs);
  }
}
