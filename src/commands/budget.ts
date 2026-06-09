import { Command } from '@oclif/core';

/**
 * `bank budget` topic. With no subcommand, runs `bank budget status` so the
 * user can quickly see how they're tracking. Subcommands cover setup and
 * management (import, show, matcher).
 */
export default class Budget extends Command {
  static description = 'Track actuals against your imported budget.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>                          # show status for the default window',
    '<%= config.bin %> <%= command.id %> import ~/Downloads/budget.csv',
    '<%= config.bin %> <%= command.id %> show',
    '<%= config.bin %> <%= command.id %> status --since thismonth',
    '<%= config.bin %> <%= command.id %> matcher add cash-expenses::groceries --field category --pattern grocery',
  ];

  static strict = false;

  async run(): Promise<void> {
    const args = this.argv;

    // No args, or the first positional looks like a flag (e.g. `bank budget
    // -f table`, `bank budget --since thismonth`) - delegate to status with
    // all args, since that's the most useful default.
    if (args.length === 0 || args[0].startsWith('-')) {
      await this.config.runCommand('budget:status', args);
      return;
    }

    // Walk argument list to find deepest matching command id. Lets us
    // dispatch both flat (`budget show`) and nested (`budget matcher add`)
    // forms. Stop walking as soon as we'd include a flag in the id - flags
    // are arguments to the resolved subcommand, not part of its name.
    let resolvedId: string | null = null;
    let consumed = 0;
    for (let depth = Math.min(args.length, 3); depth > 0; depth--) {
      const slice = args.slice(0, depth);
      if (slice.some(s => s.startsWith('-'))) continue;
      const candidate = ['budget', ...slice].join(':');
      const cmd = this.config.findCommand(candidate);
      if (cmd && cmd.id === candidate) {
        resolvedId = candidate;
        consumed = depth;
        break;
      }
    }

    if (!resolvedId) {
      this.error(`Unknown subcommand: "${args[0]}"\nRun "bank budget --help" to see available subcommands.`);
    }

    await this.config.runCommand(resolvedId, args.slice(consumed));
  }
}
