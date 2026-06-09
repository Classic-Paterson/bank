import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { budgetService } from '../../services/budget.service.js';
import { formatCurrency } from '../../utils/output.js';

export default class BudgetShow extends Command {
  static description = 'Show the active budget definition and which lines have matchers configured.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --unmatched',
  ];

  static override flags = {
    unmatched: Flags.boolean({
      description: 'Only show lines that have no matchers configured',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(BudgetShow);

    const budget = budgetService.load();
    if (!budget) {
      this.log(chalk.yellow('No budget imported yet.'));
      this.log('Run: bank budget import <path-to-csv>');
      return;
    }

    const lines = flags.unmatched
      ? budget.lines.filter(l => l.matchers.length === 0)
      : budget.lines;

    if (lines.length === 0) {
      this.log(chalk.green('All budget lines have matchers configured.'));
      return;
    }

    const table = new Table({
      head: ['Category', 'Subcategory', 'Period', 'Amount', 'Dir', 'Matchers'],
      style: { head: ['cyan'] },
      colWidths: [20, 28, 12, 12, 8, 30],
      wordWrap: true,
    });

    let currentCat = '';
    for (const line of lines) {
      const cat = line.category === currentCat ? '' : line.category;
      currentCat = line.category;
      const matcherSummary = line.matchers.length === 0
        ? chalk.red('(none)')
        : line.matchers.map(m => `${m.field}~${m.pattern}`).join(', ');
      table.push([
        cat,
        line.subcategory,
        line.period,
        formatCurrency(line.amount),
        line.direction,
        matcherSummary,
      ]);
    }
    this.log(table.toString());

    const missing = budget.lines.filter(l => l.matchers.length === 0).length;
    if (!flags.unmatched && missing > 0) {
      this.log('');
      this.log(chalk.yellow(`${missing} line${missing === 1 ? '' : 's'} have no matchers. Add them with:`));
      this.log(`  bank budget matcher add <line-id> --field <field> --pattern <text>`);
    }
  }
}
