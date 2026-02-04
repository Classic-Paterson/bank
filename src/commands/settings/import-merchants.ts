import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import * as fs from 'fs';

import { merchantMappingService } from '../../services/merchant-mapping.service.js';
import { getErrorMessage } from '../../utils/error.js';
import { MerchantMap } from '../../types/index.js';

export default class SettingsImportMerchants extends Command {
  static description = 'Import merchant mappings from JSON file';

  static override args = {
    file: Args.string({
      description: 'JSON file to import from',
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> merchants.json     # Import from file (replaces existing)',
    '<%= config.bin %> <%= command.id %> merchants.json -m  # Merge with existing mappings',
    '<%= config.bin %> <%= command.id %> merchants.json -y  # Skip confirmation prompt',
  ];

  static override flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    }),
    merge: Flags.boolean({
      char: 'm',
      description: 'Merge imported merchants with existing (default replaces all)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(SettingsImportMerchants);

    // Check file exists
    if (!fs.existsSync(args.file)) {
      this.error(`File not found: ${args.file}`);
    }

    // Read and parse file
    let importData: MerchantMap;
    try {
      const content = fs.readFileSync(args.file, 'utf8');
      importData = JSON.parse(content) as MerchantMap;
    } catch (parseError) {
      this.error(`Invalid JSON file: ${getErrorMessage(parseError)}`);
    }

    // Validate structure
    const validationError = this.validateMerchantMapStructure(importData);
    if (validationError) {
      this.error(validationError);
    }

    const importCount = Object.keys(importData).length;
    if (importCount === 0) {
      this.warn('The import file contains no merchant mappings.');
      return;
    }

    const existingMappings = merchantMappingService.getAllMappings();
    const existingCount = Object.keys(existingMappings).length;

    // Confirm before importing
    if (!flags.yes) {
      const message = flags.merge
        ? `Merge ${importCount} mapping${importCount === 1 ? '' : 's'} with ${existingCount} existing?`
        : existingCount > 0
          ? `Replace ${existingCount} existing mapping${existingCount === 1 ? '' : 's'} with ${importCount} from file?`
          : `Import ${importCount} merchant mapping${importCount === 1 ? '' : 's'}?`;

      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message,
        default: false,
      }]);

      if (!proceed) {
        this.log('Import cancelled.');
        return;
      }
    }

    // Perform import
    let finalMappings: MerchantMap;
    if (flags.merge) {
      finalMappings = { ...existingMappings, ...importData };
    } else {
      finalMappings = importData;
    }

    const success = merchantMappingService.saveMerchantMap(finalMappings);
    if (!success) {
      this.error('Failed to save merchant mappings.');
    }

    const finalCount = Object.keys(finalMappings).length;
    if (flags.merge) {
      const newCount = finalCount - existingCount;
      const updatedCount = importCount - newCount;
      this.log(`Imported ${importCount} mapping${importCount === 1 ? '' : 's'} (${newCount} new, ${updatedCount} updated). Total: ${finalCount}`);
    } else {
      this.log(`Imported ${finalCount} merchant mapping${finalCount === 1 ? '' : 's'}.`);
    }
  }

  /**
   * Validate that imported data has the expected MerchantMap structure.
   * Returns an error message if invalid, undefined if valid.
   */
  private validateMerchantMapStructure(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return 'Invalid format: expected a JSON object with merchant mappings.';
    }

    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'object' || value === null) {
        return `Invalid mapping for "${key}": expected object with parent and category.`;
      }

      const mapping = value as Record<string, unknown>;
      if (typeof mapping.parent !== 'string' || typeof mapping.category !== 'string') {
        return `Invalid mapping for "${key}": must have "parent" and "category" string properties.`;
      }
    }

    return undefined;
  }
}
