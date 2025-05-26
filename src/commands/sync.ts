import { Command, Flags } from '@oclif/core'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

// Helper to read from stdin
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (input += chunk))
    process.stdin.on('end', () => resolve(input))
    process.stdin.on('error', (err) => reject(err))
  })
}
// Create an OAuth2 client from your client secret JSON file
function getOAuth2Client(clientSecretFile: string): OAuth2Client {
  const content = fs.readFileSync(clientSecretFile, 'utf8');
  const credentials = JSON.parse(content);
  const { client_id, client_secret, redirect_uris } = credentials.installed;
  return new OAuth2Client(client_id, client_secret, redirect_uris[0]);
}
// Get and store access token if needed
async function getAccessToken(oAuth2Client: OAuth2Client, tokenPath: string): Promise<any> {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  console.log('Authorize this app by visiting this URL:', authUrl);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code: string = await new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      resolve(code);
    });
  });
  const tokenResponse = await oAuth2Client.getToken(code);
  const token = tokenResponse.tokens;
  oAuth2Client.setCredentials(token);
  fs.writeFileSync(tokenPath, JSON.stringify(token));
  console.log('Token stored to', tokenPath);
  return token;
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
    const { flags } = await this.parse(Sync)
    const sheetIdFlag = flags.sheetId
    const oauthClientKeyPath = flags.oauthClientKey

    if (!oauthClientKeyPath) {
      this.error('OAuth2 client key file path is required. Provide it via --oauthClientKey or set the GOOGLE_OAUTH_CLIENT_KEY env var.', { exit: 1 });
    }
    // Initialize OAuth2 client
    let oAuth2Client: OAuth2Client;
    try {
      oAuth2Client = getOAuth2Client(oauthClientKeyPath);
    } catch (err: any) {
      this.error(`Error reading OAuth2 client key file: ${err.message}`, { exit: 1 });
    }

    // Define a path to store the token (in your home directory)
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      this.error('Cannot determine home directory for token storage.', { exit: 1 });
    }
    const tokenPath = path.join(homeDir, '.bank-oauth-tokens.json');

    // Load stored token if it exists, otherwise initiate OAuth flow
    if (fs.existsSync(tokenPath)) {
      try {
        const tokenContent = fs.readFileSync(tokenPath, 'utf8');
        const token = JSON.parse(tokenContent);
        oAuth2Client.setCredentials(token);
      } catch (err: any) {
        this.error(`Error reading token file: ${err.message}`, { exit: 1 });
      }
    } else {
      try {
        await getAccessToken(oAuth2Client, tokenPath);
      } catch (err: any) {
        this.error(`Error obtaining access token: ${err.message}`, { exit: 1 });
      }
    }

    // Create the Sheets API client using the authorized OAuth2 client
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

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
      // If no sheet ID provided, create a new spreadsheet
      if (!targetSheetId) {
        this.log('No Sheet ID provided. Creating a new Google Sheet...');
        const createResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: { title: 'Bank Transactions' }
          }
        });
        if (!createResponse.data.spreadsheetId) {
          throw new Error('Failed to create a new spreadsheet; no ID returned.');
        }
        targetSheetId = createResponse.data.spreadsheetId;
      }

      // Append the CSV rows to the spreadsheet (default: "Sheet1")
      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: 'Sheet1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows }
      });

      const appendedRows = rows.length - 1; // assuming the first row is a header
      this.log(`✔ Successfully appended ${appendedRows} transactions to Google Sheet (https://docs.google.com/spreadsheets/d/${targetSheetId}).`);
    } catch (err: any) {
      this.error(`Error syncing to Google Sheets: ${err.message}`, { exit: 1 });
    }
  }
}