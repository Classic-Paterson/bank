import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { budgetService } from '../../../services/budget.service.js';
import { BudgetMatcherField } from '../../../types/index.js';

const VALID_FIELDS: BudgetMatcherField[] = [
  'parentCategory', 'category', 'merchant',
  'description', 'particulars', 'account', 'type',
];

export default class BudgetMatcherAdd extends Command {
  static description = 'Add a matcher to a budget line. Matchers are case-insensitive substring matches against a transaction field.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> cash-expenses::groceries --field category --pattern "supermarkets and grocery stores"',
    '<%= config.bin %> <%= command.id %> direct-debit-bills::land-cruiser --field particulars --pattern LandCruser',
    '<%= config.bin %> <%= command.id %> direct-debit-bills::power --field merchant --pattern Powershop',
    '<%= config.bin %> <%= command.id %> income::reece-salary --field description --pattern "Salary iPayroll"',
  ];

  static override args = {
    lineId: Args.string({
      description: 'Budget line id (run `bank budget show` to find ids)',
      required: true,
    }),
  };

  static override flags = {
    field: Flags.string({
      description: 'Which transaction field to match against',
      required: true,
      options: VALID_FIELDS,
    }),
    pattern: Flags.string({
      description: 'Case-insensitive substring to look for',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(BudgetMatcherAdd);

    const budget = budgetService.load();
    if (!budget) {
      this.error('No budget imported. Run: bank budget import <path>');
    }
    const line = budget!.lines.find(l => l.id === args.lineId);
    if (!line) {
      this.error(`No budget line with id "${args.lineId}". Use \`bank budget show\` to list ids.`);
    }
    const added = budgetService.addMatcher(args.lineId, {
      field: flags.field as BudgetMatcherField,
      pattern: flags.pattern,
    });
    if (added) {
      this.log(chalk.green(`Added matcher: ${flags.field} ~ "${flags.pattern}" → ${line!.subcategory}`));
    } else {
      this.log(chalk.dim(`Matcher already exists: ${flags.field} ~ "${flags.pattern}" → ${line!.subcategory}`));
    }
  }
}
