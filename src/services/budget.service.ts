import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseCsv } from 'csv-parse/sync';

import {
  CONFIG_DIR_NAME,
  BUDGET_FILE_NAME,
  BUDGET_MATCHERS_FILE_NAME,
  SECURE_FILE_MODE,
  isExcludedTransactionType,
} from '../constants/index.js';
import {
  Budget,
  BudgetActual,
  BudgetLine,
  BudgetMatcher,
  BudgetPeriod,
  FormattedTransaction,
} from '../types/index.js';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_PERIOD: Record<BudgetPeriod, number> = {
  annual: 365.25,
  monthly: 365.25 / 12,
  fortnightly: 14,
  weekly: 7,
};

/**
 * Manages the user's budget definition (CSV with period columns) and the
 * sidecar matchers JSON that maps each budget line to transaction rules.
 *
 * Why two files: the CSV is meant to be hand-editable in Sheets/Excel so it
 * mirrors the user's existing budget spreadsheet workflow. Matchers are
 * structured data (substring patterns against various transaction fields)
 * which doesn't belong in a CSV row.
 */
class BudgetService {
  private configDir: string;
  private budgetFile: string;
  private matchersFile: string;

  constructor() {
    this.configDir = path.join(homedir(), CONFIG_DIR_NAME);
    this.budgetFile = path.join(this.configDir, BUDGET_FILE_NAME);
    this.matchersFile = path.join(this.configDir, BUDGET_MATCHERS_FILE_NAME);
  }

  get budgetFilePath(): string {
    return this.budgetFile;
  }

  get matchersFilePath(): string {
    return this.matchersFile;
  }

  /** True if a budget CSV has been imported. */
  exists(): boolean {
    return fs.existsSync(this.budgetFile);
  }

  /**
   * Load the budget from CSV + matchers JSON. Returns null if no budget has
   * been imported yet. Callers should check exists() first.
   */
  load(): Budget | null {
    if (!this.exists()) return null;
    const csv = fs.readFileSync(this.budgetFile, 'utf8');
    const lines = this.parseBudgetCsv(csv);
    const matchers = this.loadMatchers();
    for (const line of lines) {
      line.matchers = matchers[line.id] ?? [];
    }
    return { lines };
  }

  /**
   * Import a budget from an external CSV. Existing matchers are preserved
   * for any lines whose ids still exist after the import.
   */
  importFromCsv(sourcePath: string): { added: number; preservedMatchers: number; missingMatchers: number } {
    const absSource = path.resolve(sourcePath);
    if (!fs.existsSync(absSource)) {
      throw new Error(`Source CSV not found: ${absSource}`);
    }
    const content = fs.readFileSync(absSource, 'utf8');
    // Parse to validate before writing
    const lines = this.parseBudgetCsv(content);

    // Ensure config dir exists
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    fs.writeFileSync(this.budgetFile, content, { mode: SECURE_FILE_MODE });

    // Reconcile matchers: keep entries for lines that still exist
    const existing = this.loadMatchers();
    const ids = new Set(lines.map(l => l.id));
    const next: Record<string, BudgetMatcher[]> = {};
    let preserved = 0;
    for (const [id, m] of Object.entries(existing)) {
      if (ids.has(id)) {
        next[id] = m;
        preserved++;
      }
    }
    this.saveMatchers(next);

    const missing = lines.filter(l => (next[l.id] ?? []).length === 0).length;
    return { added: lines.length, preservedMatchers: preserved, missingMatchers: missing };
  }

  /**
   * Convert an Annual/Monthly/Fortnightly/Weekly CSV (the user's existing
   * spreadsheet format) into a normalised list of BudgetLines. We prefer the
   * Annual column when present so all amounts are stored at the same cadence.
   */
  private parseBudgetCsv(content: string): BudgetLine[] {
    const records = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const result: BudgetLine[] = [];
    let currentCategory = '';

    for (const row of records) {
      const cat = (row['Category'] ?? '').trim();
      const sub = (row['Subcategory'] ?? '').trim();

      if (cat && !sub) {
        // Section header row (e.g. "Income" with no subcategory)
        currentCategory = cat;
        continue;
      }
      if (!sub) continue;
      if (this.isTotalRow(sub)) continue;
      if (this.isSummaryHeader(cat)) continue;

      const annual = this.parseAmount(row['Annual']);
      const monthly = this.parseAmount(row['Monthly']);
      const fortnightly = this.parseAmount(row['Fortnightly']);
      const weekly = this.parseAmount(row['Weekly']);

      let amount = 0;
      let period: BudgetPeriod = 'annual';
      if (annual !== null) { amount = annual; period = 'annual'; }
      else if (monthly !== null) { amount = monthly; period = 'monthly'; }
      else if (fortnightly !== null) { amount = fortnightly; period = 'fortnightly'; }
      else if (weekly !== null) { amount = weekly; period = 'weekly'; }
      else continue; // no amount = skip

      const direction = this.inferDirection(currentCategory);
      const id = this.makeId(currentCategory, sub);

      result.push({
        id,
        category: currentCategory || '(uncategorised)',
        subcategory: sub,
        period,
        amount,
        direction,
        notes: (row['Notes'] ?? '').trim() || undefined,
        matchers: [], // populated by load() from sidecar JSON
      });
    }

    return result;
  }

  private isTotalRow(subcategory: string): boolean {
    const s = subcategory.toLowerCase();
    return s.startsWith('total ') || s === 'surplus/deficit';
  }

  private isSummaryHeader(category: string): boolean {
    return category.toLowerCase() === 'summary';
  }

  /**
   * Infer transaction direction from the budget section name. The user's
   * spreadsheet groups Income/Savings/Liquid Savings/Cash Expenses/etc.
   */
  private inferDirection(category: string): 'in' | 'out' | 'savings' {
    const c = category.toLowerCase();
    if (c.includes('income')) return 'in';
    if (c.includes('savings')) return 'savings';
    return 'out';
  }

  /** Normalise a budget line id - lowercase, separator clean */
  private makeId(category: string, subcategory: string): string {
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const cat = norm(category) || 'misc';
    const sub = norm(subcategory);
    return `${cat}::${sub}`;
  }

  private parseAmount(raw: string | undefined): number | null {
    if (!raw) return null;
    const cleaned = raw.replace(/[$,\s]/g, '').replace(/^\$/, '');
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  loadMatchers(): Record<string, BudgetMatcher[]> {
    if (!fs.existsSync(this.matchersFile)) return {};
    try {
      const raw = fs.readFileSync(this.matchersFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, BudgetMatcher[]>;
      }
      return {};
    } catch {
      return {};
    }
  }

  saveMatchers(matchers: Record<string, BudgetMatcher[]>): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    fs.writeFileSync(
      this.matchersFile,
      JSON.stringify(matchers, null, 2),
      { mode: SECURE_FILE_MODE }
    );
  }

  setMatchers(lineId: string, matchers: BudgetMatcher[]): void {
    const all = this.loadMatchers();
    if (matchers.length === 0) {
      delete all[lineId];
    } else {
      all[lineId] = matchers;
    }
    this.saveMatchers(all);
  }

  /**
   * Add a matcher to a budget line. Idempotent: if an identical matcher
   * (same field + same pattern, case-insensitive) already exists, returns
   * false without modifying storage. Returns true if a new matcher was
   * added.
   */
  addMatcher(lineId: string, matcher: BudgetMatcher): boolean {
    const all = this.loadMatchers();
    const list = all[lineId] ?? [];
    const exists = list.some(
      m => m.field === matcher.field && m.pattern.toLowerCase() === matcher.pattern.toLowerCase()
    );
    if (exists) return false;
    list.push(matcher);
    all[lineId] = list;
    this.saveMatchers(all);
    return true;
  }

  /** Annualised amount for any budget line, regardless of input period. */
  annualAmount(line: BudgetLine): number {
    switch (line.period) {
      case 'annual': return line.amount;
      case 'monthly': return line.amount * 12;
      case 'fortnightly': return line.amount * 26;
      case 'weekly': return line.amount * 52;
    }
  }

  /**
   * Expected amount for a budget line over an arbitrary date window. We
   * pro-rate by days (line.amount * windowDays / periodDays). This is
   * approximate but stable and matches the user's mental model of "what
   * should I have spent so far this month".
   */
  expectedForRange(line: BudgetLine, startDate: Date, endDate: Date): number {
    const periodDays = DAYS_PER_PERIOD[line.period];
    const windowDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
    return line.amount * (windowDays / periodDays);
  }

  /**
   * Match a single transaction against a single line's matchers. Direction is
   * checked too: 'out' lines only match negative-amount transactions, 'in'
   * and 'savings' lines only match positive amounts. Returns true if any
   * matcher hits.
   */
  matchesLine(line: BudgetLine, tx: FormattedTransaction): boolean {
    if (line.matchers.length === 0) return false;

    if (line.direction === 'out' && tx.amount >= 0) return false;
    if ((line.direction === 'in' || line.direction === 'savings') && tx.amount <= 0) return false;

    for (const m of line.matchers) {
      const value = this.fieldValue(tx, m.field);
      if (!value) continue;
      if (value.toLowerCase().includes(m.pattern.toLowerCase())) return true;
    }
    return false;
  }

  private fieldValue(tx: FormattedTransaction, field: BudgetMatcher['field']): string {
    switch (field) {
      case 'parentCategory': return tx.parentCategory;
      case 'category': return tx.category;
      case 'merchant': return tx.merchant;
      case 'description': return tx.description ?? '';
      case 'particulars': return tx.particulars ?? '';
      case 'account': return tx.accountName ?? '';
      case 'type': return tx.type ?? '';
    }
  }

  /**
   * Aggregate actuals for every budget line against a window of transactions.
   * Returns one BudgetActual per line (lines with no matches still appear, so
   * unmatched lines are visible in the output).
   *
   * Matching is "envelope budgeting" - a single transaction can match at
   * most ONE line per direction (out/in/savings). This reflects how the
   * user's spreadsheet works: Sam's $500 deposit to the Savings account
   * counts as both income (Sam Salary, direction=in) AND a savings
   * allocation (General Savings, direction=savings). The same money is
   * recorded in both budget views, mirroring the spreadsheet's structure
   * where Total Income and Total Outgoings (which includes Savings) both
   * track the same flows.
   *
   * Within each direction, lines are checked in CSV order; first match
   * wins for that direction.
   *
   * Also returns the set of transaction ids that matched at least one line,
   * so callers can compute "unaccounted" totals on what's left over.
   */
  computeActuals(
    lines: BudgetLine[],
    transactions: FormattedTransaction[],
    startDate: Date,
    endDate: Date,
  ): { actuals: BudgetActual[]; matchedIds: Set<string> } {
    const sums = new Map<string, { actual: number; count: number }>();
    for (const line of lines) {
      sums.set(line.id, { actual: 0, count: 0 });
    }
    const matchedIds = new Set<string>();

    const linesByDirection: Record<string, BudgetLine[]> = {
      savings: lines.filter(l => l.direction === 'savings'),
      in: lines.filter(l => l.direction === 'in'),
      out: lines.filter(l => l.direction === 'out'),
    };

    for (const tx of transactions) {
      // Skip transaction types that aren't real outflows/inflows in the
      // budget sense (TRANSFER pairs, LOAN INTEREST accruals, bank fees,
      // interest credits on savings accounts).
      if (isExcludedTransactionType(tx.type)) continue;

      for (const direction of ['savings', 'in', 'out'] as const) {
        for (const line of linesByDirection[direction]) {
          if (this.matchesLine(line, tx)) {
            const entry = sums.get(line.id)!;
            entry.actual += Math.abs(tx.amount);
            entry.count += 1;
            matchedIds.add(tx.id);
            break; // one match per direction
          }
        }
      }
    }

    const actuals = lines.map(line => {
      const expected = this.expectedForRange(line, startDate, endDate);
      const { actual, count } = sums.get(line.id)!;
      const paceRatio = expected > 0 ? actual / expected : 0;
      return { line, expected, actual, count, paceRatio };
    });
    return { actuals, matchedIds };
  }
}

export const budgetService = new BudgetService();
