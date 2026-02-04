import { expect } from 'chai';
import { transactionProcessingService } from '../../src/services/transaction-processing.service.js';
import { merchantMappingService, normaliseMerchantName } from '../../src/services/merchant-mapping.service.js';
import { FormattedTransaction, MerchantMap } from '../../src/types/index.js';
import { Account, EnrichedTransaction } from 'akahu';

describe('transaction processing service', () => {
  // Save and restore merchant mappings to isolate tests from user config
  let originalMappings: MerchantMap;

  before(() => {
    originalMappings = merchantMappingService.getAllMappings();
    // Clear mappings for test isolation
    merchantMappingService.clearAllMappings();
  });

  after(() => {
    // Restore original mappings
    merchantMappingService.saveMerchantMap(originalMappings);
    merchantMappingService.invalidateCache();
  });
  // Test data factories
  const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
    _id: 'acc_123',
    _credentials: 'cred_123',
    connection: {
      _id: 'conn_123',
      name: 'Test Bank',
    },
    name: 'Test Account',
    status: 'ACTIVE',
    formatted_account: '12-3456-7890123-00',
    type: 'CHECKING',
    ...overrides,
  } as Account);

  const createMockEnrichedTransaction = (overrides: Partial<EnrichedTransaction> = {}): EnrichedTransaction => ({
    _id: 'tx_123',
    _account: 'acc_123',
    _connection: 'conn_123',
    _user: 'user_123',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    date: '2024-01-15',
    description: 'Test transaction',
    amount: -50.00,
    type: 'DEBIT',
    merchant: { _id: 'merch_123', name: 'Test Merchant' },
    category: {
      _id: 'cat_123',
      name: 'Groceries',
      groups: {
        personal_finance: { _id: 'group_food', name: 'Food' },
      },
    },
    meta: {
      particulars: 'Test particulars',
    },
    ...overrides,
  } as EnrichedTransaction);

  const createFormattedTransaction = (overrides: Partial<FormattedTransaction> = {}): FormattedTransaction => ({
    id: 'tx_123',
    date: new Date('2024-01-15'),
    accountName: 'Test Account',
    accountNumber: '12-3456-7890123-00',
    amount: -50.00,
    description: 'Test transaction',
    particulars: 'Test particulars',
    merchant: 'Test Merchant',
    category: 'Groceries',
    parentCategory: 'Food',
    type: 'DEBIT',
    ...overrides,
  });

  describe('formatTransactions', () => {
    it('formats a single transaction correctly', () => {
      const accounts = [createMockAccount()];
      const transactions = [createMockEnrichedTransaction()];

      const result = transactionProcessingService.formatTransactions(transactions, accounts);

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.include({
        id: 'tx_123',
        accountName: 'Test Account',
        accountNumber: '12-3456-7890123-00',
        amount: -50.00,
        description: 'Test transaction',
        particulars: 'Test particulars',
        merchant: 'Test Merchant',
        category: 'Groceries',
        parentCategory: 'Food',
        type: 'DEBIT',
      });
      expect(result[0].date).to.be.instanceOf(Date);
    });

    it('handles missing category gracefully', () => {
      const accounts = [createMockAccount()];
      const transactions = [createMockEnrichedTransaction({ category: undefined })];

      const result = transactionProcessingService.formatTransactions(transactions, accounts);

      expect(result[0].category).to.equal('Uncategorized');
      expect(result[0].parentCategory).to.equal('Uncategorized');
    });

    it('handles missing merchant gracefully', () => {
      const accounts = [createMockAccount()];
      const transactions = [createMockEnrichedTransaction({ merchant: undefined })];

      const result = transactionProcessingService.formatTransactions(transactions, accounts);

      expect(result[0].merchant).to.equal('');
    });

    it('handles missing meta/particulars gracefully', () => {
      const accounts = [createMockAccount()];
      const transactions = [createMockEnrichedTransaction({ meta: undefined })];

      const result = transactionProcessingService.formatTransactions(transactions, accounts);

      expect(result[0].particulars).to.equal('');
    });

    it('handles unknown account gracefully', () => {
      const accounts: Account[] = [];
      const transactions = [createMockEnrichedTransaction()];

      const result = transactionProcessingService.formatTransactions(transactions, accounts);

      expect(result[0].accountName).to.equal('');
      expect(result[0].accountNumber).to.equal('');
    });

    it('maps multiple accounts correctly using O(1) lookup', () => {
      const accounts = [
        createMockAccount({ _id: 'acc_1', name: 'Account 1', formatted_account: '11-1111-1111111-00' }),
        createMockAccount({ _id: 'acc_2', name: 'Account 2', formatted_account: '22-2222-2222222-00' }),
        createMockAccount({ _id: 'acc_3', name: 'Account 3', formatted_account: '33-3333-3333333-00' }),
      ];
      const transactions = [
        createMockEnrichedTransaction({ _id: 'tx_1', _account: 'acc_2' }),
        createMockEnrichedTransaction({ _id: 'tx_2', _account: 'acc_1' }),
        createMockEnrichedTransaction({ _id: 'tx_3', _account: 'acc_3' }),
      ];

      const result = transactionProcessingService.formatTransactions(transactions, accounts);

      expect(result[0].accountName).to.equal('Account 2');
      expect(result[1].accountName).to.equal('Account 1');
      expect(result[2].accountName).to.equal('Account 3');
    });

    describe('merchant mapping integration', () => {
      // Store the original method to restore after each test
      let originalLoadMerchantMap: typeof merchantMappingService.loadMerchantMap;

      beforeEach(() => {
        originalLoadMerchantMap = merchantMappingService.loadMerchantMap.bind(merchantMappingService);
      });

      afterEach(() => {
        // Restore the original method
        merchantMappingService.loadMerchantMap = originalLoadMerchantMap;
      });

      it('applies user-defined merchant mapping to override API category', () => {
        // Keys are stored normalized (lowercase, special chars replaced with spaces)
        const merchantMap: MerchantMap = {
          [normaliseMerchantName('Test Merchant')]: { parent: 'lifestyle', category: 'entertainment' },
        };
        merchantMappingService.loadMerchantMap = () => merchantMap;

        const accounts = [createMockAccount()];
        const transactions = [createMockEnrichedTransaction({
          merchant: { _id: 'merch_123', name: 'Test Merchant' },
          category: {
            _id: 'cat_123',
            name: 'Groceries',
            groups: { personal_finance: { _id: 'group_food', name: 'Food' } },
          },
        })];

        const result = transactionProcessingService.formatTransactions(transactions, accounts, true);

        expect(result[0].parentCategory).to.equal('lifestyle');
        expect(result[0].category).to.equal('entertainment');
      });

      it('falls back to API category when no merchant mapping exists', () => {
        // Keys are stored normalized - 'Other Merchant' normalizes differently than 'Test Merchant'
        const merchantMap: MerchantMap = {
          [normaliseMerchantName('Other Merchant')]: { parent: 'lifestyle', category: 'entertainment' },
        };
        merchantMappingService.loadMerchantMap = () => merchantMap;

        const accounts = [createMockAccount()];
        const transactions = [createMockEnrichedTransaction({
          merchant: { _id: 'merch_123', name: 'Test Merchant' },
          category: {
            _id: 'cat_123',
            name: 'Groceries',
            groups: { personal_finance: { _id: 'group_food', name: 'Food' } },
          },
        })];

        const result = transactionProcessingService.formatTransactions(transactions, accounts, true);

        expect(result[0].parentCategory).to.equal('Food');
        expect(result[0].category).to.equal('Groceries');
      });

      it('skips merchant mapping when applyMerchantMappings is false', () => {
        let loadCalled = false;
        merchantMappingService.loadMerchantMap = () => {
          loadCalled = true;
          return { [normaliseMerchantName('Test Merchant')]: { parent: 'lifestyle', category: 'entertainment' } };
        };

        const accounts = [createMockAccount()];
        const transactions = [createMockEnrichedTransaction({
          merchant: { _id: 'merch_123', name: 'Test Merchant' },
          category: {
            _id: 'cat_123',
            name: 'Groceries',
            groups: { personal_finance: { _id: 'group_food', name: 'Food' } },
          },
        })];

        const result = transactionProcessingService.formatTransactions(transactions, accounts, false);

        // Should use API category, not merchant mapping
        expect(result[0].parentCategory).to.equal('Food');
        expect(result[0].category).to.equal('Groceries');
        // Verify loadMerchantMap was not called when disabled
        expect(loadCalled).to.be.false;
      });

      it('handles transactions without merchant name', () => {
        const merchantMap: MerchantMap = {
          [normaliseMerchantName('Test Merchant')]: { parent: 'lifestyle', category: 'entertainment' },
        };
        merchantMappingService.loadMerchantMap = () => merchantMap;

        const accounts = [createMockAccount()];
        const transactions = [createMockEnrichedTransaction({
          merchant: undefined,
          category: {
            _id: 'cat_123',
            name: 'Groceries',
            groups: { personal_finance: { _id: 'group_food', name: 'Food' } },
          },
        })];

        const result = transactionProcessingService.formatTransactions(transactions, accounts, true);

        expect(result[0].parentCategory).to.equal('Food');
        expect(result[0].category).to.equal('Groceries');
      });

      it('uses Uncategorized when merchant mapping and API category are both missing', () => {
        merchantMappingService.loadMerchantMap = () => ({});

        const accounts = [createMockAccount()];
        const transactions = [createMockEnrichedTransaction({
          merchant: { _id: 'merch_unknown', name: 'Unknown Merchant' },
          category: undefined,
        })];

        const result = transactionProcessingService.formatTransactions(transactions, accounts, true);

        expect(result[0].parentCategory).to.equal('Uncategorized');
        expect(result[0].category).to.equal('Uncategorized');
      });

      it('applies merchant mapping even when API category exists (user override)', () => {
        // This tests that user's categorization takes precedence over API
        // Keys are stored normalized (lowercase, special chars replaced with spaces)
        const merchantMap: MerchantMap = {
          [normaliseMerchantName('Countdown')]: { parent: 'food', category: 'groceries' },
        };
        merchantMappingService.loadMerchantMap = () => merchantMap;

        const accounts = [createMockAccount()];
        const transactions = [createMockEnrichedTransaction({
          merchant: { _id: 'merch_countdown', name: 'Countdown' },
          category: {
            _id: 'cat_123',
            name: 'Supermarket',
            groups: { personal_finance: { _id: 'group_shopping', name: 'Shopping' } },
          },
        })];

        const result = transactionProcessingService.formatTransactions(transactions, accounts, true);

        // User's mapping should override API's category
        expect(result[0].parentCategory).to.equal('food');
        expect(result[0].category).to.equal('groceries');
      });
    });
  });

  describe('applyFilters', () => {
    it('returns transactions sorted by date', () => {
      const transactions = [
        createFormattedTransaction({ id: 'tx_3', date: new Date('2024-01-20') }),
        createFormattedTransaction({ id: 'tx_1', date: new Date('2024-01-10') }),
        createFormattedTransaction({ id: 'tx_2', date: new Date('2024-01-15') }),
      ];

      const result = transactionProcessingService.applyFilters(transactions, {});

      expect(result[0].id).to.equal('tx_1');
      expect(result[1].id).to.equal('tx_2');
      expect(result[2].id).to.equal('tx_3');
    });

    describe('account filter', () => {
      it('filters by account number', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', accountNumber: '11-1111-1111111-00' }),
          createFormattedTransaction({ id: 'tx_2', accountNumber: '22-2222-2222222-00' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { accountId: '11-1111-1111111-00' });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_1');
      });

      it('filters by account name (case insensitive)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', accountName: 'Savings Account' }),
          createFormattedTransaction({ id: 'tx_2', accountName: 'Checking Account' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { accountId: 'SAVINGS ACCOUNT' });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_1');
      });
    });

    describe('category filter', () => {
      it('filters by category (partial match, case insensitive)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', category: 'Groceries' }),
          createFormattedTransaction({ id: 'tx_2', category: 'Restaurant' }),
          createFormattedTransaction({ id: 'tx_3', category: 'Grocery Store' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { category: 'grocer' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_3']);
      });
    });

    describe('parent category filter', () => {
      it('filters by parent category (exact match, case insensitive)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', parentCategory: 'Food' }),
          createFormattedTransaction({ id: 'tx_2', parentCategory: 'Transport' }),
          createFormattedTransaction({ id: 'tx_3', parentCategory: 'Food' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { parentCategory: 'FOOD' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_3']);
      });
    });

    describe('merchant filter', () => {
      it('filters by single merchant (partial match, case insensitive)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', merchant: 'Countdown' }),
          createFormattedTransaction({ id: 'tx_2', merchant: 'New World' }),
          createFormattedTransaction({ id: 'tx_3', merchant: 'Countdown Supermarket' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { merchant: 'countdown' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_3']);
      });

      it('filters by comma-separated merchants', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', merchant: 'Countdown' }),
          createFormattedTransaction({ id: 'tx_2', merchant: 'New World' }),
          createFormattedTransaction({ id: 'tx_3', merchant: 'Pak n Save' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { merchant: 'countdown, new world' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_2']);
      });

      it('ignores empty merchant values in comma-separated list', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', merchant: 'Countdown' }),
          createFormattedTransaction({ id: 'tx_2', merchant: 'New World' }),
        ];

        // Empty strings would match everything if not handled
        const result = transactionProcessingService.applyFilters(transactions, { merchant: ',countdown,' });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_1');
      });
    });

    describe('amount filters', () => {
      it('filters by minAmount using absolute value', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -10 }),
          createFormattedTransaction({ id: 'tx_2', amount: -50 }),
          createFormattedTransaction({ id: 'tx_3', amount: 30 }), // positive (income)
        ];

        const result = transactionProcessingService.applyFilters(transactions, { minAmount: 25 });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_2', 'tx_3']);
      });

      it('filters by maxAmount using absolute value', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -10 }),
          createFormattedTransaction({ id: 'tx_2', amount: -50 }),
          createFormattedTransaction({ id: 'tx_3', amount: 100 }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { maxAmount: 25 });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_1');
      });

      it('filters by both minAmount and maxAmount', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -10 }),
          createFormattedTransaction({ id: 'tx_2', amount: -50 }),
          createFormattedTransaction({ id: 'tx_3', amount: -100 }),
          createFormattedTransaction({ id: 'tx_4', amount: 30 }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { minAmount: 25, maxAmount: 75 });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_2', 'tx_4']);
      });
    });

    describe('type filter', () => {
      it('filters by transaction type (partial match, case insensitive)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', type: 'DEBIT' }),
          createFormattedTransaction({ id: 'tx_2', type: 'CREDIT' }),
          createFormattedTransaction({ id: 'tx_3', type: 'DIRECT DEBIT' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { type: 'debit' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_3']);
      });
    });

    describe('search filter', () => {
      it('searches by exact transaction ID', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_abc123', description: 'Something else' }),
          createFormattedTransaction({ id: 'tx_def456', description: 'Another thing' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { search: 'tx_abc123' });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_abc123');
      });

      it('searches by description (partial match, case insensitive)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', description: 'Coffee at Starbucks' }),
          createFormattedTransaction({ id: 'tx_2', description: 'Grocery shopping' }),
          createFormattedTransaction({ id: 'tx_3', description: 'Coffee machine purchase' }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { search: 'COFFEE' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_3']);
      });

      it('searches by transaction ID case-insensitively', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_ABC123', description: 'Something else' }),
          createFormattedTransaction({ id: 'tx_def456', description: 'Another thing' }),
        ];

        // Search with different case should still find the transaction
        const result = transactionProcessingService.applyFilters(transactions, { search: 'TX_abc123' });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_ABC123');
      });
    });

    describe('combined filters', () => {
      it('applies multiple filters together (AND logic)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', category: 'Groceries', merchant: 'Countdown', amount: -100 }),
          createFormattedTransaction({ id: 'tx_2', category: 'Groceries', merchant: 'New World', amount: -50 }),
          createFormattedTransaction({ id: 'tx_3', category: 'Restaurant', merchant: 'Countdown', amount: -30 }),
          createFormattedTransaction({ id: 'tx_4', category: 'Groceries', merchant: 'Countdown', amount: -10 }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, {
          category: 'Groceries',
          merchant: 'Countdown',
          minAmount: 50,
        });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_1');
      });
    });

    describe('direction filter', () => {
      it('filters by direction "out" for spending (negative amounts)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -50 }),
          createFormattedTransaction({ id: 'tx_2', amount: 100 }),
          createFormattedTransaction({ id: 'tx_3', amount: -30 }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { direction: 'out' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_3']);
      });

      it('filters by direction "in" for income (positive amounts)', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -50 }),
          createFormattedTransaction({ id: 'tx_2', amount: 100 }),
          createFormattedTransaction({ id: 'tx_3', amount: 200 }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { direction: 'in' });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_2', 'tx_3']);
      });

      it('excludes zero amounts from "in" filter', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: 0 }),
          createFormattedTransaction({ id: 'tx_2', amount: 100 }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { direction: 'in' });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_2');
      });

      it('excludes zero amounts from "out" filter', () => {
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: 0 }),
          createFormattedTransaction({ id: 'tx_2', amount: -50 }),
        ];

        const result = transactionProcessingService.applyFilters(transactions, { direction: 'out' });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_2');
      });

      it('combines direction "out" with amount filters to find spending in a range', () => {
        // Common use case: "show me all my spending between $50 and $200"
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -25 }),   // spending, too small
          createFormattedTransaction({ id: 'tx_2', amount: -75 }),   // spending, in range
          createFormattedTransaction({ id: 'tx_3', amount: -150 }),  // spending, in range
          createFormattedTransaction({ id: 'tx_4', amount: -300 }),  // spending, too large
          createFormattedTransaction({ id: 'tx_5', amount: 100 }),   // income, filtered by direction
          createFormattedTransaction({ id: 'tx_6', amount: 500 }),   // income, filtered by direction
        ];

        const result = transactionProcessingService.applyFilters(transactions, {
          direction: 'out',
          minAmount: 50,
          maxAmount: 200,
        });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_2', 'tx_3']);
      });

      it('combines direction "in" with amount filters to find income in a range', () => {
        // Common use case: "show me income between $1000 and $5000"
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: 500 }),    // income, too small
          createFormattedTransaction({ id: 'tx_2', amount: 1500 }),   // income, in range
          createFormattedTransaction({ id: 'tx_3', amount: 3000 }),   // income, in range
          createFormattedTransaction({ id: 'tx_4', amount: 10000 }),  // income, too large
          createFormattedTransaction({ id: 'tx_5', amount: -2000 }),  // spending, filtered by direction
        ];

        const result = transactionProcessingService.applyFilters(transactions, {
          direction: 'in',
          minAmount: 1000,
          maxAmount: 5000,
        });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_2', 'tx_3']);
      });

      it('combines direction with merchant and amount filters', () => {
        // Use case: "how much have I spent at supermarkets between $50-$200?"
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -75, merchant: 'Countdown' }),
          createFormattedTransaction({ id: 'tx_2', amount: -120, merchant: 'New World' }),
          createFormattedTransaction({ id: 'tx_3', amount: -300, merchant: 'Countdown' }), // too large
          createFormattedTransaction({ id: 'tx_4', amount: -90, merchant: 'BP Fuel' }),    // wrong merchant
          createFormattedTransaction({ id: 'tx_5', amount: 100, merchant: 'Countdown' }),  // income
        ];

        const result = transactionProcessingService.applyFilters(transactions, {
          direction: 'out',
          merchant: 'countdown, new world',
          minAmount: 50,
          maxAmount: 200,
        });

        expect(result).to.have.length(2);
        expect(result.map(t => t.id)).to.include.members(['tx_1', 'tx_2']);
      });

      it('combines direction with category and amount filters', () => {
        // Use case: "show me food spending over $50"
        const transactions = [
          createFormattedTransaction({ id: 'tx_1', amount: -75, parentCategory: 'Food' }),
          createFormattedTransaction({ id: 'tx_2', amount: -30, parentCategory: 'Food' }),     // too small
          createFormattedTransaction({ id: 'tx_3', amount: -100, parentCategory: 'Transport' }), // wrong category
          createFormattedTransaction({ id: 'tx_4', amount: 200, parentCategory: 'Food' }),    // income
        ];

        const result = transactionProcessingService.applyFilters(transactions, {
          direction: 'out',
          parentCategory: 'Food',
          minAmount: 50,
        });

        expect(result).to.have.length(1);
        expect(result[0].id).to.equal('tx_1');
      });
    });
  });

  describe('calculateCategoryBreakdown', () => {
    it('groups spending by parent category', () => {
      const transactions = [
        createFormattedTransaction({ parentCategory: 'Food', amount: -50 }),
        createFormattedTransaction({ parentCategory: 'Food', amount: -30 }),
        createFormattedTransaction({ parentCategory: 'Transport', amount: -20 }),
      ];

      const result = transactionProcessingService.calculateCategoryBreakdown(transactions);

      expect(result).to.deep.equal({
        food: 80,
        transport: 20,
      });
    });

    it('excludes income (positive amounts)', () => {
      const transactions = [
        createFormattedTransaction({ parentCategory: 'Food', amount: -50 }),
        createFormattedTransaction({ parentCategory: 'Income', amount: 1000 }),
      ];

      const result = transactionProcessingService.calculateCategoryBreakdown(transactions);

      expect(result).to.deep.equal({ food: 50 });
      expect(result).to.not.have.property('income');
    });

    it('excludes transfer transactions', () => {
      const transactions = [
        createFormattedTransaction({ parentCategory: 'Food', amount: -50, type: 'DEBIT' }),
        createFormattedTransaction({ parentCategory: 'Transfer', amount: -100, type: 'TRANSFER' }),
      ];

      const result = transactionProcessingService.calculateCategoryBreakdown(transactions);

      expect(result).to.deep.equal({ food: 50 });
      expect(result).to.not.have.property('transfer');
    });

    it('handles empty transaction list', () => {
      const result = transactionProcessingService.calculateCategoryBreakdown([]);

      expect(result).to.deep.equal({});
    });

    it('normalizes category names to lowercase', () => {
      const transactions = [
        createFormattedTransaction({ parentCategory: 'Food', amount: -50 }),
        createFormattedTransaction({ parentCategory: 'FOOD', amount: -30 }),
        createFormattedTransaction({ parentCategory: 'food', amount: -20 }),
      ];

      const result = transactionProcessingService.calculateCategoryBreakdown(transactions);

      expect(result).to.deep.equal({ food: 100 });
    });

    it('uses Uncategorized for empty parent category', () => {
      const transactions = [
        createFormattedTransaction({ parentCategory: '', amount: -50 }),
        createFormattedTransaction({ parentCategory: '  ', amount: -30 }),
      ];

      const result = transactionProcessingService.calculateCategoryBreakdown(transactions);

      expect(result).to.have.property('Uncategorized');
      expect(result['Uncategorized']).to.equal(80);
    });
  });

  describe('calculateSummary', () => {
    it('calculates total transactions, amount, and spending', () => {
      const transactions = [
        createFormattedTransaction({ amount: -50, type: 'DEBIT' }),
        createFormattedTransaction({ amount: -30, type: 'DEBIT' }),
        createFormattedTransaction({ amount: 100, type: 'CREDIT' }),
      ];

      const result = transactionProcessingService.calculateSummary(transactions);

      expect(result.totalTransactions).to.equal(3);
      expect(result.totalAmount).to.equal(20); // -50 + -30 + 100
      expect(result.totalSpending).to.equal(80); // abs(-50) + abs(-30)
    });

    it('excludes transfers from spending calculation', () => {
      const transactions = [
        createFormattedTransaction({ amount: -50, type: 'DEBIT' }),
        createFormattedTransaction({ amount: -100, type: 'TRANSFER' }),
      ];

      const result = transactionProcessingService.calculateSummary(transactions);

      expect(result.totalSpending).to.equal(50); // Only the DEBIT
      expect(result.totalAmount).to.equal(-150); // Both included in total
    });

    it('handles empty transaction list', () => {
      const result = transactionProcessingService.calculateSummary([]);

      expect(result.totalTransactions).to.equal(0);
      expect(result.totalAmount).to.equal(0);
      expect(result.totalSpending).to.equal(0);
    });
  });

  describe('getUncategorizedTransactions', () => {
    it('returns transactions without category name', () => {
      const transactions = [
        createMockEnrichedTransaction({ _id: 'tx_1', category: { _id: 'cat_1', name: 'Groceries', groups: { personal_finance: { _id: 'group_food', name: 'Food' } } } as any }),
        createMockEnrichedTransaction({ _id: 'tx_2', category: { _id: 'cat_2', name: undefined, groups: { personal_finance: { _id: 'group_food', name: 'Food' } } } as any }),
      ];

      const result = transactionProcessingService.getUncategorizedTransactions(transactions);

      expect(result).to.have.length(1);
      expect(result[0]._id).to.equal('tx_2');
    });

    it('returns transactions without personal_finance group', () => {
      const transactions = [
        createMockEnrichedTransaction({ _id: 'tx_1', category: { _id: 'cat_1', name: 'Groceries', groups: { personal_finance: { _id: 'group_food', name: 'Food' } } } as any }),
        createMockEnrichedTransaction({ _id: 'tx_2', category: { _id: 'cat_2', name: 'Unknown', groups: {} } as any }),
      ];

      const result = transactionProcessingService.getUncategorizedTransactions(transactions);

      expect(result).to.have.length(1);
      expect(result[0]._id).to.equal('tx_2');
    });

    it('excludes transfer transactions', () => {
      const transactions = [
        createMockEnrichedTransaction({ _id: 'tx_1', type: 'TRANSFER', category: undefined }),
        createMockEnrichedTransaction({ _id: 'tx_2', type: 'DEBIT', category: undefined }),
      ];

      const result = transactionProcessingService.getUncategorizedTransactions(transactions);

      expect(result).to.have.length(1);
      expect(result[0]._id).to.equal('tx_2');
    });
  });

  describe('generateDisplayData', () => {
    it('converts dates to locale strings', () => {
      const transactions = [
        createFormattedTransaction({ date: new Date('2024-01-15') }),
      ];

      const result = transactionProcessingService.generateDisplayData(transactions, 'json', true);

      expect(result[0].date).to.be.a('string');
    });

    it('returns lean view for table format without details', () => {
      const transactions = [
        createFormattedTransaction(),
      ];

      const result = transactionProcessingService.generateDisplayData(transactions, 'table', false);

      expect(result[0]).to.have.keys(['date', 'account', 'amount', 'description', 'category']);
      expect(result[0]).to.not.have.keys(['id', 'accountNumber', 'merchant', 'parentCategory', 'type']);
    });

    it('returns full view for table format with details', () => {
      const transactions = [
        createFormattedTransaction(),
      ];

      const result = transactionProcessingService.generateDisplayData(transactions, 'table', true);

      expect(result[0]).to.have.property('id');
      expect(result[0]).to.have.property('merchant');
      expect(result[0]).to.have.property('parentCategory');
    });

    it('returns full view for non-table formats', () => {
      const transactions = [
        createFormattedTransaction(),
      ];

      const result = transactionProcessingService.generateDisplayData(transactions, 'json', false);

      expect(result[0]).to.have.property('id');
      expect(result[0]).to.have.property('merchant');
    });

    describe('relative time formatting', () => {
      it('formats today as "today"', () => {
        const transactions = [
          createFormattedTransaction({ date: new Date() }),
        ];

        const result = transactionProcessingService.generateDisplayData(transactions, 'table', false, true);

        expect(result[0].date).to.equal('today');
      });

      it('formats yesterday as "yesterday"', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const transactions = [
          createFormattedTransaction({ date: yesterday }),
        ];

        const result = transactionProcessingService.generateDisplayData(transactions, 'table', false, true);

        expect(result[0].date).to.equal('yesterday');
      });

      it('formats recent days as "Xd ago"', () => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const transactions = [
          createFormattedTransaction({ date: threeDaysAgo }),
        ];

        const result = transactionProcessingService.generateDisplayData(transactions, 'table', false, true);

        expect(result[0].date).to.equal('3d ago');
      });

      it('formats weeks as "Xw ago"', () => {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const transactions = [
          createFormattedTransaction({ date: twoWeeksAgo }),
        ];

        const result = transactionProcessingService.generateDisplayData(transactions, 'table', false, true);

        expect(result[0].date).to.equal('2w ago');
      });

      it('falls back to locale date for old transactions', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 60);
        const transactions = [
          createFormattedTransaction({ date: oldDate }),
        ];

        const result = transactionProcessingService.generateDisplayData(transactions, 'table', false, true);

        // Should be a locale date string, not a relative time
        expect(result[0].date).to.not.include('ago');
        expect(result[0].date).to.be.a('string');
      });

      it('uses locale date when useRelativeTime is false', () => {
        const transactions = [
          createFormattedTransaction({ date: new Date() }),
        ];

        const result = transactionProcessingService.generateDisplayData(transactions, 'table', false, false);

        expect(result[0].date).to.not.equal('today');
      });
    });
  });
});
