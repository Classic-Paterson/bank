import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_DIR_NAME,
  SAVED_QUERIES_FILE_NAME,
  SECURE_FILE_MODE,
} from '../constants/index.js';
import { SavedQuery, SavedQueryMap, TransactionFilter } from '../types/index.js';

/**
 * Service for managing saved transaction queries
 */
class QueryService {
  private configDir: string;
  private queriesFile: string;

  constructor() {
    this.configDir = path.join(homedir(), CONFIG_DIR_NAME);
    this.queriesFile = path.join(this.configDir, SAVED_QUERIES_FILE_NAME);
    this.ensureConfigDirectory();
  }

  private ensureConfigDirectory(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private loadQueries(): SavedQueryMap {
    if (!fs.existsSync(this.queriesFile)) {
      return {};
    }

    try {
      const data = fs.readFileSync(this.queriesFile, 'utf8');
      return JSON.parse(data) as SavedQueryMap;
    } catch {
      return {};
    }
  }

  private saveQueries(queries: SavedQueryMap): void {
    this.ensureConfigDirectory();
    try {
      fs.writeFileSync(
        this.queriesFile,
        JSON.stringify(queries, null, 2),
        { mode: SECURE_FILE_MODE }
      );
    } catch (error) {
      throw new Error(`Failed to save queries: ${error}`);
    }
  }

  /**
   * Save a new query
   */
  save(name: string, filters: TransactionFilter, description?: string): SavedQuery {
    const queries = this.loadQueries();

    const query: SavedQuery = {
      name,
      description,
      filters,
      createdAt: new Date().toISOString(),
    };

    queries[name] = query;
    this.saveQueries(queries);

    return query;
  }

  /**
   * Get a saved query by name
   */
  get(name: string): SavedQuery | undefined {
    const queries = this.loadQueries();
    return queries[name];
  }

  /**
   * List all saved queries
   */
  list(): SavedQuery[] {
    const queries = this.loadQueries();
    return Object.values(queries).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Delete a saved query
   */
  delete(name: string): boolean {
    const queries = this.loadQueries();

    if (!queries[name]) {
      return false;
    }

    delete queries[name];
    this.saveQueries(queries);
    return true;
  }

  /**
   * Update last used timestamp
   */
  markUsed(name: string): void {
    const queries = this.loadQueries();

    if (queries[name]) {
      queries[name].lastUsed = new Date().toISOString();
      this.saveQueries(queries);
    }
  }

  /**
   * Check if a query exists
   */
  exists(name: string): boolean {
    const queries = this.loadQueries();
    return name in queries;
  }

  /**
   * Rename a query
   */
  rename(oldName: string, newName: string): boolean {
    const queries = this.loadQueries();

    if (!queries[oldName] || queries[newName]) {
      return false;
    }

    queries[newName] = { ...queries[oldName], name: newName };
    delete queries[oldName];
    this.saveQueries(queries);
    return true;
  }
}

// Export singleton instance
export const queryService = new QueryService();
