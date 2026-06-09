import { Args, Command } from '@oclif/core';
import chalk from 'chalk';
import { budgetService } from '../../services/budget.service.js';
import { getErrorMessage } from '../../utils/error.js';

export default class BudgetImport extends Command {
  static description = 'Import a budget CSV (Category, Subcategory, Annual, Monthly, Fortnightly, Weekly, Notes).';

  static override examples = [
    '<%= config.bin %> <%= command.id %> ~/Downloads/Personal\\ Budget.csv',
  ];

  static override args = {
    path: Args.string({ description: 'Path to budget CSV', required: true }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(BudgetImport);
    try {
      const { added, preservedMatchers, missingMatchers } = budgetService.importFromCsv(args.path);
      this.log(`Imported ${added} budget line${added === 1 ? '' : 's'}.`);
      if (preservedMatchers > 0) {
        this.log(chalk.dim(`Preserved matchers for ${preservedMatchers} line${preservedMatchers === 1 ? '' : 's'} from previous import.`));
      }
      if (missingMatchers > 0) {
        this.log(chalk.yellow(`${missingMatchers} line${missingMatchers === 1 ? '' : 's'} have no matchers - configure them with \`bank budget show\` to see which.`));
      }
      this.log(chalk.dim(`Budget file: ${budgetService.budgetFilePath}`));
      this.log(chalk.dim(`Matchers:    ${budgetService.matchersFilePath}`));
    } catch (e) {
      this.error(`Import failed: ${getErrorMessage(e)}`);
    }
  }
}
