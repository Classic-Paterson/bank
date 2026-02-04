import { Command } from '@oclif/core';

export default class Query extends Command {
  static description = 'Save, list, and run named transaction queries';

  static hidden = true;

  static strict = false;

  async run(): Promise<void> {
    const args = this.argv;

    if (args.length === 0) {
      await this.config.runCommand('help', ['query']);
      return;
    }

    const subcommand = args[0];
    const commandId = `query:${subcommand}`;
    const remainingArgs = args.slice(1);

    // Check if command exists
    const command = this.config.findCommand(commandId);
    if (!command) {
      this.error(`Unknown subcommand: ${subcommand}\nRun "bank query --help" to see available subcommands.`);
    }

    await this.config.runCommand(commandId, remainingArgs);
  }
}
