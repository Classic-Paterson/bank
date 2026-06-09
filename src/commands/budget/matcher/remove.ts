import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { budgetService } from '../../../services/budget.service.js';

export default class BudgetMatcherRemove extends Command {
  static description = 'Remove a matcher from a budget line by index, or all matchers with --all.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> cash-expenses::groceries --index 0',
    '<%= config.bin %> <%= command.id %> cash-expenses::groceries --all',
  ];

  static override args = {
    lineId: Args.string({ description: 'Budget line id', required: true }),
  };

  static override flags = {
    index: Flags.integer({ description: 'Matcher index to remove (0-based)' }),
    all: Flags.boolean({ description: 'Remove all matchers from this line', default: false }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(BudgetMatcherRemove);
    if (flags.index === undefined && !flags.all) {
      this.error('Pass --index <n> or --all');
    }
    const all = budgetService.loadMatchers();
    const current = all[args.lineId] ?? [];
    if (current.length === 0) {
      this.log(chalk.yellow('Line has no matchers to remove.'));
      return;
    }

    if (flags.all) {
      budgetService.setMatchers(args.lineId, []);
      this.log(chalk.green(`Removed all ${current.length} matchers from ${args.lineId}.`));
      return;
    }

    const idx = flags.index!;
    if (idx < 0 || idx >= current.length) {
      this.error(`Index ${idx} out of range (line has ${current.length} matcher${current.length === 1 ? '' : 's'}).`);
    }
    const [removed] = current.splice(idx, 1);
    budgetService.setMatchers(args.lineId, current);
    this.log(chalk.green(`Removed: ${removed.field} ~ "${removed.pattern}"`));
  }
}
