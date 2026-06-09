import { expect } from 'chai';
import { internalTransferService } from '../../src/services/internal-transfer.service.js';
import { FormattedTransaction } from '../../src/types/index.js';

describe('internal transfer service', () => {
  const makeTx = (overrides: Partial<FormattedTransaction> = {}): FormattedTransaction => ({
    id: 'tx_' + Math.random().toString(36).slice(2, 8),
    date: new Date('2026-03-01'),
    accountName: 'Income',
    accountNumber: '38-9008-0675230-16',
    amount: -100,
    description: 'TEST',
    particulars: '',
    merchant: '',
    category: 'Uncategorized',
    parentCategory: 'Uncategorized',
    type: 'STANDING ORDER',
    ...overrides,
  });

  describe('pair matching', () => {
    it('matches a debit and credit of the same magnitude on different accounts', () => {
      const a = makeTx({ id: 'a', amount: -647.51, accountName: 'Income', accountNumber: '01' });
      const b = makeTx({ id: 'b', amount: 647.51, accountName: 'Mortgage', accountNumber: '02' });
      const annotations = internalTransferService.annotate([a, b]);
      expect(annotations.get('a')?.isInternal).to.equal(true);
      expect(annotations.get('b')?.isInternal).to.equal(true);
      expect(annotations.get('a')?.pairedTransactionId).to.equal('b');
      expect(annotations.get('b')?.pairedTransactionId).to.equal('a');
      expect(annotations.get('a')?.reason).to.equal('matched-pair');
    });

    it('does not pair transactions on the same account', () => {
      // A bank-side credit followed by a debit on the same account at the same
      // amount is not a transfer between accounts.
      const a = makeTx({ id: 'a', amount: -50, accountNumber: '01' });
      const b = makeTx({ id: 'b', amount: 50, accountNumber: '01' });
      const annotations = internalTransferService.annotate([a, b]);
      expect(annotations.size).to.equal(0);
    });

    it('does not pair when both are negative', () => {
      const a = makeTx({ id: 'a', amount: -50, accountNumber: '01' });
      const b = makeTx({ id: 'b', amount: -50, accountNumber: '02' });
      const annotations = internalTransferService.annotate([a, b]);
      expect(annotations.size).to.equal(0);
    });

    it('honours the window when matching dates', () => {
      const a = makeTx({ id: 'a', amount: -100, accountNumber: '01', date: new Date('2026-03-01') });
      const farB = makeTx({ id: 'b', amount: 100, accountNumber: '02', date: new Date('2026-03-15') });
      const closeB = makeTx({ id: 'c', amount: 100, accountNumber: '02', date: new Date('2026-03-02') });

      const annotations = internalTransferService.annotate([a, farB, closeB], { windowDays: 3 });
      // a should pair with c (the close one), not b (the far one)
      expect(annotations.get('a')?.pairedTransactionId).to.equal('c');
      expect(annotations.get('c')?.isInternal).to.equal(true);
      expect(annotations.get('b')?.isInternal).to.be.undefined;
    });

    it('leaves a salary credit alone when there is no matching debit', () => {
      // A real income credit has no offsetting debit on another linked account.
      const salary = makeTx({
        id: 'salary',
        amount: 8342.67,
        type: 'CREDIT',
        accountNumber: '01',
        description: 'Salary iPayroll',
      });
      const annotations = internalTransferService.annotate([salary]);
      expect(annotations.size).to.equal(0);
    });

    it('handles many same-magnitude transactions by closest pairing', () => {
      // Two mortgage AP fortnightly payments of $647.51 each
      const out1 = makeTx({ id: 'out1', amount: -647.51, accountNumber: '01', date: new Date('2026-03-12') });
      const in1 = makeTx({ id: 'in1', amount: 647.51, accountNumber: '02', date: new Date('2026-03-12') });
      const out2 = makeTx({ id: 'out2', amount: -647.51, accountNumber: '01', date: new Date('2026-03-26') });
      const in2 = makeTx({ id: 'in2', amount: 647.51, accountNumber: '02', date: new Date('2026-03-26') });

      const annotations = internalTransferService.annotate([out1, in1, out2, in2]);
      expect(annotations.get('out1')?.pairedTransactionId).to.equal('in1');
      expect(annotations.get('out2')?.pairedTransactionId).to.equal('in2');
    });
  });

  describe('self-pattern fallback', () => {
    it('marks one-sided standing orders matching a self pattern', () => {
      // Counterparty leg outside data window - only the debit shows up.
      const tx = makeTx({
        id: 'tx1',
        amount: -250,
        type: 'STANDING ORDER',
        description: 'AP#23307054 TO M J PATERSON',
        accountNumber: '01',
      });
      const annotations = internalTransferService.annotate([tx], {
        selfPatterns: ['M J PATERSON'],
      });
      expect(annotations.get('tx1')?.isInternal).to.equal(true);
      expect(annotations.get('tx1')?.reason).to.equal('self-pattern');
    });

    it('does not mark non-standing-order debits even if name appears', () => {
      // Avoid false positive: "PAY M J PATERSON dinner" shouldn't be internal.
      const tx = makeTx({
        id: 'tx1',
        amount: -50,
        type: 'PAYMENT',
        description: 'PAY M J PATERSON dinner',
      });
      const annotations = internalTransferService.annotate([tx], {
        selfPatterns: ['M J PATERSON'],
      });
      expect(annotations.get('tx1')?.isInternal).to.be.undefined;
    });
  });

  describe('filterOutInternal', () => {
    it('removes matched-pair transactions and keeps real spending', () => {
      const transferOut = makeTx({ id: 'to', amount: -100, accountNumber: '01' });
      const transferIn = makeTx({ id: 'ti', amount: 100, accountNumber: '02' });
      const realSpend = makeTx({
        id: 'rs',
        amount: -42.50,
        type: 'DEBIT',
        description: 'PAK N SAVE',
        accountNumber: '01',
      });
      const filtered = internalTransferService.filterOutInternal([transferOut, transferIn, realSpend]);
      expect(filtered).to.have.lengthOf(1);
      expect(filtered[0].id).to.equal('rs');
    });
  });

  describe('summarize', () => {
    it('counts pairs as a single move when totalling', () => {
      const a = makeTx({ id: 'a', amount: -200, accountNumber: '01' });
      const b = makeTx({ id: 'b', amount: 200, accountNumber: '02' });
      const annotations = internalTransferService.annotate([a, b]);
      const summary = internalTransferService.summarize([a, b], annotations);
      // 2 legs but 1 logical move worth $200
      expect(summary.count).to.equal(2);
      expect(summary.absTotal).to.equal(200);
    });
  });
});
