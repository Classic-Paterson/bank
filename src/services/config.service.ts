import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_DIR_NAME,
  CONFIG_FILE_NAME,
  SECURE_FILE_MODE,
  DEFAULT_FORMAT,
} from '../constants/index.js';
import { AppConfig } from '../types/index.js';

/**
 * Service for managing application configuration
 */
class ConfigService {
  private configDir: string;
  private configFile: string;
  private config: AppConfig;
  private _configLoadError: boolean = false;

  constructor() {
    this.configDir = path.join(homedir(), CONFIG_DIR_NAME);
    this.configFile = path.join(this.configDir, CONFIG_FILE_NAME);
    this.ensureConfigDirectory();
    this.config = this.loadConfig();
  }

  private ensureConfigDirectory(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private loadConfig(): AppConfig {
    if (!fs.existsSync(this.configFile)) {
      return { format: DEFAULT_FORMAT };
    }

    try {
      const data = fs.readFileSync(this.configFile, 'utf8');
      return JSON.parse(data) as AppConfig;
    } catch {
      // Config file is corrupted - use defaults and flag the error
      // Commands can check configService.hadLoadError to warn the user
      this._configLoadError = true;
      return { format: DEFAULT_FORMAT };
    }
  }

  private saveConfig(): void {
    this.ensureConfigDirectory();
    try {
      fs.writeFileSync(
        this.configFile,
        JSON.stringify(this.config, null, 2),
        { mode: SECURE_FILE_MODE }
      );
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  get<T = any>(key: string): T | undefined {
    return this.config[key] as T;
  }

  set(key: string, value: any): void {
    this.config[key] = value;
    this.saveConfig();
  }

  reset(key: string): void {
    delete this.config[key];
    this.saveConfig();
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  has(key: string): boolean {
    return key in this.config;
  }

  /**
   * Returns true if the config file failed to load (corrupted/invalid JSON).
   * Commands can check this to warn users if needed.
   */
  get hadLoadError(): boolean {
    return this._configLoadError;
  }
}

// Export singleton instance
export const configService = new ConfigService();
