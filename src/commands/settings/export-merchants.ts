import { Args, Command } from '@oclif/core';
import * as fs from 'fs';

import { merchantMappingService } from '../../services/merchant-mapping.service.js';

export default class SettingsExportMerchants extends Command {
  static description = 'Export merchant mappings to JSON';

  static override args = {
    file: Args.string({
      description: 'Output file path (outputs to stdout if not provided)',
      required: false,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %>                    # Export to stdout (pipe to file)',
    '<%= config.bin %> <%= command.id %> merchants.json     # Export to file',
  ];

  public async run(): Promise<void> {
    const { args } = await this.parse(SettingsExportMerchants);

    const mappings = merchantMappingService.getAllMappings();
    const count = Object.keys(mappings).length;

    if (count === 0) {
      this.warn('No merchant mappings to export. Use "bank categorise" to create mappings.');
      return;
    }

    const json = JSON.stringify(mappings, null, 2);

    if (args.file) {
      // Write to file
      fs.writeFileSync(args.file, json);
      this.log(`Exported ${count} merchant mapping${count === 1 ? '' : 's'} to ${args.file}`);
    } else {
      // Output to stdout (for piping)
      console.log(json);
    }
  }
}
