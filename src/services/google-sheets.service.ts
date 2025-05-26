import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import {
  OAUTH_TOKENS_FILE_NAME,
  GOOGLE_SHEETS_SCOPE,
  SECURE_FILE_MODE,
} from '../constants/index.js';
import { GoogleOAuthConfig } from '../types/index.js';

/**
 * Service for handling Google OAuth2 authentication and Google Sheets operations
 */
class GoogleSheetsService {
  private tokenPath: string;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error('Cannot determine home directory for token storage.');
    }
    this.tokenPath = path.join(homeDir, OAUTH_TOKENS_FILE_NAME);
  }

  /**
   * Create OAuth2 client from client secret JSON file
   */
  createOAuth2Client(clientSecretFile: string): OAuth2Client {
    try {
      const content = fs.readFileSync(clientSecretFile, 'utf8');
      const credentials: GoogleOAuthConfig = JSON.parse(content);
      const { client_id, client_secret, redirect_uris } = credentials.installed;
      return new OAuth2Client(client_id, client_secret, redirect_uris[0]);
    } catch (error) {
      throw new Error(`Failed to read OAuth2 client secret file: ${error}`);
    }
  }

  /**
   * Get access token through OAuth2 flow
   */
  async getAccessToken(oAuth2Client: OAuth2Client): Promise<any> {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [GOOGLE_SHEETS_SCOPE],
    });

    console.log('Authorize this app by visiting this URL:', authUrl);

    const code = await this.promptForAuthCode();
    
    try {
      const tokenResponse = await oAuth2Client.getToken(code);
      const token = tokenResponse.tokens;
      
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(this.tokenPath, JSON.stringify(token), { mode: SECURE_FILE_MODE });
      console.log('Token stored to', this.tokenPath);
      
      return token;
    } catch (error) {
      throw new Error(`Failed to exchange authorization code for tokens: ${error}`);
    }
  }

  /**
   * Prompt user for authorization code
   */
  private async promptForAuthCode(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        resolve(code);
      });
    });
  }

  /**
   * Load stored token and set credentials
   */
  async loadStoredToken(oAuth2Client: OAuth2Client): Promise<boolean> {
    if (!fs.existsSync(this.tokenPath)) {
      return false;
    }

    try {
      const tokenContent = fs.readFileSync(this.tokenPath, 'utf8');
      const token = JSON.parse(tokenContent);
      oAuth2Client.setCredentials(token);
      return true;
    } catch (error) {
      console.warn('Warning: Could not load stored token. Re-authentication required.');
      return false;
    }
  }

  /**
   * Initialize authenticated Google Sheets client
   */
  async initializeSheetsClient(clientSecretFile: string) {
    const oAuth2Client = this.createOAuth2Client(clientSecretFile);
    
    const tokenLoaded = await this.loadStoredToken(oAuth2Client);
    if (!tokenLoaded) {
      await this.getAccessToken(oAuth2Client);
    }

    return google.sheets({ version: 'v4', auth: oAuth2Client });
  }

  /**
   * Create a new Google Spreadsheet
   */
  async createSpreadsheet(sheets: any, title: string = 'Bank Transactions'): Promise<string> {
    try {
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title }
        }
      });
      
      if (!response.data.spreadsheetId) {
        throw new Error('Failed to create spreadsheet; no ID returned.');
      }
      
      return response.data.spreadsheetId;
    } catch (error) {
      throw new Error(`Failed to create spreadsheet: ${error}`);
    }
  }

  /**
   * Append data to a Google Spreadsheet
   */
  async appendToSpreadsheet(
    sheets: any,
    spreadsheetId: string,
    data: string[][],
    range: string = 'Sheet1'
  ): Promise<void> {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: data }
      });
    } catch (error) {
      throw new Error(`Failed to append data to spreadsheet: ${error}`);
    }
  }
}

// Export singleton instance
export const googleSheetsService = new GoogleSheetsService();
