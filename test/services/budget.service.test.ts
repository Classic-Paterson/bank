import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { budgetService } from '../../src/services/budget.service.js';
import { FormattedTransaction, BudgetLine } from '../../src/types/index.js';

describe('budget service', () => {
  const csvPath = path.join(os.tmpdir(), 'test-budget.csv');

  before(() => {
    const csv = [
      'Category,Subcategory,Annual,Monthly,Fortnightly,Weekly,Notes',
      'Income,,,,,,',
      ',Reece Salary,$100104.00,$8342.00,$3850.15,$1925.08,',
      ',Total Income,$100104.00,,,,',
      ',,,,,,',
      'Cash Expenses,,,,,,',
      ',Fuel,$5400.00,$450.00,$207.69,$103.85,Bumped from $280',
      ',Groceries,$21000.00,$1750.00,$807.69,$403.85,Bumped from $1400',
      ',Total Cash Expenses,$26400.00,,,,',
      ',,,,,,',
      'Savings,,,,,,',
      ',General Savings,$26000.00,$2166.67,$1000.00,$500.00,Sam income',
    ].join('\n');
    fs.writeFileSync(csvPath, csv);
  });

  describe('parseBudgetCsv via importFromCsv', () => {
    it('parses sections, ignores totals, and assigns directions', () => {
      // Use a temp config home so we don't disturb the user's real budget
      const originalHome = process.env.HOME;
      const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bank-budget-'));
      process.env.HOME = tmpHome;
      try {
        // Re-import the service so it picks up the new HOME. Service is a
        // singleton with paths set in constructor, so we use reflection.
        // (Acceptable in tests; production code uses the singleton directly.)
        const svc = budgetService as unknown as {
          configDir: string;
          budgetFile: string;
          matchersFile: string;
        };
        svc.configDir = path.join(tmpHome, '.bankcli');
        svc.budgetFile = path.join(svc.configDir, 'budget.csv');
        svc.matchersFile = path.join(svc.configDir, 'budget.matchers.json');

        const result = budgetService.importFromCsv(csvPath);
        // 1 income (Reece Salary) + 2 cash (Fuel, Groceries) + 1 savings (General Savings)
        // = 4 lines (Total rows are filtered out)
        expect(result.added).to.equal(4);
        expect(result.missingMatchers).to.equal(4);

        const budget = budgetService.load();
        expect(budget).to.not.be.null;
        expect(budget!.lines).to.have.lengthOf(4);

        const fuel = budget!.lines.find(l => l.subcategory === 'Fuel');
        expect(fuel).to.exist;
        expect(fuel!.direction).to.equal('out');
        expect(fuel!.period).to.equal('annual');
        expect(fuel!.amount).to.equal(5400);

        const salary = budget!.lines.find(l => l.subcategory === 'Reece Salary');
        expect(salary!.direction).to.equal('in');

        const sav = budget!.lines.find(l => l.subcategory === 'General Savings');
        expect(sav!.direction).to.equal('savings');
      } finally {
        process.env.HOME = originalHome;
      }
    });
  });

  describe('matchesLine', () => {
    const baseLine: BudgetLine = {
      id: 'cash-expenses::groceries',
      category: 'Cash Expenses',
      subcategory: 'Groceries',
      period: 'monthly',
      amount: 1750,
      direction: 'out',
      matchers: [{ field: 'category', pattern: 'supermarkets and grocery stores' }],
    };

    const baseTx = (overrides: Partial<FormattedTransaction> = {}): FormattedTransaction => ({
      id: 't1',
      date: new Date('2026-05-15'),
      accountName: 'Income',
      accountNumber: '01',
      amount: -42.50,
      description: 'PAK N SAVE',
      particulars: '',
      merchant: 'Pak N Save',
      category: 'Supermarkets and grocery stores',
      parentCategory: 'Food',
      type: 'DEBIT',
      ...overrides,
    });

    it('matches via category substring', () => {
      expect(budgetService.matchesLine(baseLine, baseTx())).to.equal(true);
    });

    it('rejects positive-amount transactions for "out" lines', () => {
      expect(budgetService.matchesLine(baseLine, baseTx({ amount: 50 }))).to.equal(false);
    });

    it('rejects negative-amount transactions for "in" lines', () => {
      const income: BudgetLine = {
        ...baseLine,
        direction: 'in',
        matchers: [{ field: 'description', pattern: 'Salary iPayroll' }],
      };
      expect(budgetService.matchesLine(income, baseTx({ amount: -100, description: 'Salary iPayroll' }))).to.equal(false);
      expect(budgetService.matchesLine(income, baseTx({ amount: 8000, description: 'Salary iPayroll' }))).to.equal(true);
    });

    it('matches by description and particulars', () => {
      const landCruiser: BudgetLine = {
        ...baseLine,
        id: 'dd::land-cruiser',
        subcategory: 'Land Cruiser',
        matchers: [
          { field: 'particulars', pattern: 'LandCruser' },
          { field: 'description', pattern: 'AP#23307054' },
        ],
      };
      expect(budgetService.matchesLine(landCruiser, baseTx({
        description: 'AP#23307054 TO M J PATERSON', amount: -250,
      }))).to.equal(true);
      expect(budgetService.matchesLine(landCruiser, baseTx({
        description: 'something else', particulars: 'LandCruser', amount: -250,
      }))).to.equal(true);
    });
  });

  describe('expectedForRange', () => {
    const line: BudgetLine = {
      id: 'x', category: 'c', subcategory: 's',
      period: 'monthly', amount: 300, direction: 'out', matchers: [],
    };
    it('prorates monthly budgets by window length', () => {
      const start = new Date('2026-06-01T00:00:00Z');
      const end = new Date('2026-06-15T00:00:00Z'); // 14 days
      const expected = budgetService.expectedForRange(line, start, end);
      // 300 * (14 / ~30.44) = ~138
      expect(expected).to.be.closeTo(138, 1);
    });
    it('uses period directly for fortnightly budgets over 14 days', () => {
      const fn: BudgetLine = { ...line, period: 'fortnightly', amount: 470.38 };
      const start = new Date('2026-06-01T00:00:00Z');
      const end = new Date('2026-06-15T00:00:00Z');
      const expected = budgetService.expectedForRange(fn, start, end);
      expect(expected).to.be.closeTo(470.38, 0.01);
    });
  });

  describe('annualAmount', () => {
    it('converts each period to annual', () => {
      expect(budgetService.annualAmount({ period: 'annual', amount: 1000 } as BudgetLine)).to.equal(1000);
      expect(budgetService.annualAmount({ period: 'monthly', amount: 100 } as BudgetLine)).to.equal(1200);
      expect(budgetService.annualAmount({ period: 'fortnightly', amount: 100 } as BudgetLine)).to.equal(2600);
      expect(budgetService.annualAmount({ period: 'weekly', amount: 100 } as BudgetLine)).to.equal(5200);
    });
  });

  describe('computeActuals envelope budgeting', () => {
    const makeTx = (overrides: Partial<FormattedTransaction> = {}): FormattedTransaction => ({
      id: 'tx_' + Math.random().toString(36).slice(2, 8),
      date: new Date('2026-05-15'),
      accountName: 'Income',
      accountNumber: '01',
      amount: -100,
      description: '',
      particulars: '',
      merchant: '',
      category: 'Uncategorized',
      parentCategory: 'Uncategorized',
      type: 'DEBIT',
      ...overrides,
    });

    it('counts a positive deposit toward both Sam Salary (in) and General Savings (savings)', () => {
      const lines: BudgetLine[] = [
        {
          id: 'in::sam-salary',
          category: 'Income', subcategory: 'Sam Salary',
          period: 'annual', amount: 31200, direction: 'in',
          matchers: [{ field: 'description', pattern: 'HAIRQUARTERS' }],
        },
        {
          id: 'sav::general',
          category: 'Savings', subcategory: 'General Savings',
          period: 'annual', amount: 26000, direction: 'savings',
          matchers: [{ field: 'account', pattern: 'Savings' }],
        },
      ];
      const tx = makeTx({
        amount: 500,
        accountName: 'Savings',
        description: 'Automatic Payment Drawings HAIRQUARTERS',
        type: 'CREDIT',
      });
      const result = budgetService.computeActuals(
        lines, [tx], new Date('2026-05-01'), new Date('2026-06-01')
      );
      const sam = result.actuals.find(a => a.line.id === 'in::sam-salary')!;
      const sav = result.actuals.find(a => a.line.id === 'sav::general')!;
      expect(sam.actual).to.equal(500); // income side counted
      expect(sav.actual).to.equal(500); // savings allocation also counted
      expect(result.matchedIds.size).to.equal(1);
    });

    it('still picks only one line per direction (CSV order wins)', () => {
      const lines: BudgetLine[] = [
        // Two competing income lines - only the first should match per tx
        {
          id: 'in::reece', category: 'Income', subcategory: 'Reece',
          period: 'annual', amount: 100000, direction: 'in',
          matchers: [{ field: 'description', pattern: 'Salary' }],
        },
        {
          id: 'in::sam', category: 'Income', subcategory: 'Sam',
          period: 'annual', amount: 30000, direction: 'in',
          matchers: [{ field: 'description', pattern: 'Salary' }],
        },
      ];
      const tx = makeTx({ amount: 8000, description: 'Salary iPayroll', type: 'CREDIT' });
      const { actuals } = budgetService.computeActuals(
        lines, [tx], new Date('2026-05-01'), new Date('2026-06-01')
      );
      expect(actuals.find(a => a.line.id === 'in::reece')!.actual).to.equal(8000);
      expect(actuals.find(a => a.line.id === 'in::sam')!.actual).to.equal(0);
    });

    it('skips excluded transaction types (LOAN INTEREST etc)', () => {
      const lines: BudgetLine[] = [
        {
          id: 'out::interest', category: 'Misc', subcategory: 'Interest',
          period: 'annual', amount: 100, direction: 'out',
          matchers: [{ field: 'description', pattern: 'INTEREST' }],
        },
      ];
      const tx = makeTx({ amount: -500, description: 'LOAN INTEREST', type: 'LOAN' });
      const { actuals, matchedIds } = budgetService.computeActuals(
        lines, [tx], new Date('2026-05-01'), new Date('2026-06-01')
      );
      expect(actuals[0].actual).to.equal(0);
      expect(matchedIds.size).to.equal(0);
    });
  });

  describe('addMatcher idempotence', () => {
    it('returns false and does not duplicate when the same matcher is added twice', () => {
      const originalHome = process.env.HOME;
      const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bank-idem-'));
      process.env.HOME = tmpHome;
      try {
        const svc = budgetService as unknown as {
          configDir: string; budgetFile: string; matchersFile: string;
        };
        svc.configDir = path.join(tmpHome, '.bankcli');
        svc.budgetFile = path.join(svc.configDir, 'budget.csv');
        svc.matchersFile = path.join(svc.configDir, 'budget.matchers.json');

        const matcher = { field: 'category' as const, pattern: 'groceries' };
        expect(budgetService.addMatcher('test::line', matcher)).to.equal(true);
        expect(budgetService.addMatcher('test::line', matcher)).to.equal(false);
        // Case-insensitive pattern match
        expect(budgetService.addMatcher('test::line', { field: 'category', pattern: 'GROCERIES' })).to.equal(false);

        const stored = budgetService.loadMatchers();
        expect(stored['test::line']).to.have.lengthOf(1);
      } finally {
        process.env.HOME = originalHome;
      }
    });
  });
});
