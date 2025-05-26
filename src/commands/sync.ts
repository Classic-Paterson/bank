import { Command, Flags } from '@oclif/core';
import { googleSheetsService } from '../services/google-sheets.service.js';

// Helper to read from stdin
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (input += chunk));
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', (err) => reject(err));
  });
}

export default class Sync extends Command {
  static description = 'Sync CSV transaction data to a Google Sheets spreadsheet using OAuth2 (User Account)'

  static examples = [
    `$ bank transactions -f csv | bank sync --sheetId <YOUR_SHEET_ID> --oauthClientKey /path/to/client_secret.json`,
    `$ bank transactions -f csv | bank sync --oauthClientKey /path/to/client_secret.json  # (creates a new sheet if none specified)`
  ]

  static flags = {
    sheetId: Flags.string({
      char: 's',
      description: 'ID of the Google Sheet to sync to (creates one if not provided)',
    }),
    oauthClientKey: Flags.string({
      char: 'o',
      description: 'Path to the OAuth2 client secret JSON file (uses GOOGLE_OAUTH_CLIENT_KEY env var if not set)',
      default: '/Users/reecepaterson/.bankcli/client_secret.json'

    })
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Sync);
    const sheetIdFlag = flags.sheetId;
    const oauthClientKeyPath = flags.oauthClientKey;

    if (!oauthClientKeyPath) {
      this.error('OAuth2 client key file path is required. Provide it via --oauthClientKey or set the GOOGLE_OAUTH_CLIENT_KEY env var.', { exit: 1 });
    }

    // Check for CSV input from stdin
    if (process.stdin.isTTY) {
      this.error('No CSV data detected. Pipe the CSV output from `bank transactions -f csv` into `bank sync`.', { exit: 1 });
    }

    this.log('Reading CSV data...');
    let csvData: string;
    try {
      csvData = await readStdin();
      if (!csvData.trim()) {
        throw new Error('Empty CSV data');
      }
    } catch (err: any) {
      this.error(`Error reading CSV: ${err.message}`, { exit: 1 });
    }

    // Parse CSV data into a 2D array
    const rows: string[][] = csvData
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.split(','));

    let targetSheetId = sheetIdFlag;

    try {
      // Initialize Google Sheets client
      const sheets = await googleSheetsService.initializeSheetsClient(oauthClientKeyPath);

      // If no sheet ID provided, create a new spreadsheet
      if (!targetSheetId) {
        this.log('No Sheet ID provided. Creating a new Google Sheet...');
        targetSheetId = await googleSheetsService.createSpreadsheet(sheets, 'Bank Transactions');
      }

      // Append the CSV rows to the spreadsheet
      await googleSheetsService.appendToSpreadsheet(sheets, targetSheetId, rows);

      const appendedRows = rows.length - 1; // assuming the first row is a header
      this.log(`✔ Successfully appended ${appendedRows} transactions to Google Sheet (https://docs.google.com/spreadsheets/d/${targetSheetId}).`);
    } catch (err: any) {
      this.error(`Error syncing to Google Sheets: ${err.message}`, { exit: 1 });
    }
  }
}