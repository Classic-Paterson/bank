import { FormattedTransaction } from '../types/index.js';

/**
 * Detects internal (between-your-own-accounts) transactions so they can be
 * excluded from spending/income analysis.
 *
 * The primary signal is pair matching: a negative leg on one of your accounts
 * paired with a positive leg of the same magnitude on another of your accounts
 * within a short date window. Pair matching is highly reliable because both
 * legs originate from your linked accounts in Akahu - external payments will
 * never produce a matching credit on a different linked account.
 *
 * Secondary signals (used only when pair matching can't fire, e.g. partial
 * date windows) come from config: a list of description patterns that always
 * indicate an internal move (e.g. "R M & S L PATERSON" for a household).
 */

export type InternalReason =
  | 'matched-pair'
  | 'self-pattern'
  | 'cross-account-marker';

export interface InternalAnnotation {
  isInternal: boolean;
  reason?: InternalReason;
  /** Transaction ID of the matched counterparty, if pair-matched */
  pairedTransactionId?: string;
}

export interface DetectionOptions {
  /** Days window (±) for considering two transactions a pair. Default: 3. */
  windowDays?: number;
  /**
   * Account names (or substrings) on your linked accounts. Used to detect
   * standing-order descriptions referencing one of these accounts when the
   * counterparty leg isn't in the data window. Case-insensitive substring.
   */
  selfPatterns?: string[];
}

const DEFAULT_WINDOW_DAYS = 3;
const MS_PER_DAY = 86_400_000;

class InternalTransferService {
  /**
   * Returns a Map keyed by transaction id with the internal annotation for
   * each transaction. Transactions not in the map are not internal.
   *
   * The detector is non-destructive - it returns annotations rather than
   * mutating the inputs. Callers decide what to do with that information
   * (filter, mark, color, etc.).
   */
  annotate(
    transactions: FormattedTransaction[],
    options: DetectionOptions = {}
  ): Map<string, InternalAnnotation> {
    const result = new Map<string, InternalAnnotation>();
    const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
    const windowMs = windowDays * MS_PER_DAY;

    // Group transactions by absolute amount (in cents to avoid float issues).
    // Each group contains all candidates that could be the same amount.
    const byMagnitude = new Map<number, FormattedTransaction[]>();
    for (const tx of transactions) {
      const cents = Math.round(Math.abs(tx.amount) * 100);
      if (cents === 0) continue;
      const bucket = byMagnitude.get(cents);
      if (bucket) bucket.push(tx);
      else byMagnitude.set(cents, [tx]);
    }

    // Pair matching: for each magnitude group, find the best (closest in date)
    // negative<->positive pair across different accounts. A transaction can
    // only be in one pair.
    const consumed = new Set<string>();

    for (const bucket of byMagnitude.values()) {
      if (bucket.length < 2) continue;

      // Split by direction
      const negatives = bucket.filter(tx => tx.amount < 0);
      const positives = bucket.filter(tx => tx.amount > 0);
      if (negatives.length === 0 || positives.length === 0) continue;

      // Sort negatives by date so deterministic
      const sortedNegatives = [...negatives].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      for (const neg of sortedNegatives) {
        if (consumed.has(neg.id)) continue;

        // Find the best positive partner: different account, within window,
        // not yet consumed. Prefer the smallest date distance.
        let best: { tx: FormattedTransaction; distance: number } | null = null;
        for (const pos of positives) {
          if (consumed.has(pos.id)) continue;
          if (pos.accountNumber === neg.accountNumber && pos.accountName === neg.accountName) {
            // Same account - can't be an internal transfer between accounts.
            continue;
          }
          const distance = Math.abs(pos.date.getTime() - neg.date.getTime());
          if (distance > windowMs) continue;
          if (!best || distance < best.distance) {
            best = { tx: pos, distance };
          }
        }

        if (best) {
          consumed.add(neg.id);
          consumed.add(best.tx.id);
          result.set(neg.id, {
            isInternal: true,
            reason: 'matched-pair',
            pairedTransactionId: best.tx.id,
          });
          result.set(best.tx.id, {
            isInternal: true,
            reason: 'matched-pair',
            pairedTransactionId: neg.id,
          });
        }
      }
    }

    // Secondary signal: self-patterns in description. Useful when the
    // counterparty leg falls outside the query window. We only apply this
    // to transactions not already consumed by pair matching, and only when
    // the type strongly suggests an internal move (STANDING ORDER, TRANSFER).
    const selfPatterns = (options.selfPatterns ?? [])
      .map(p => p.trim().toLowerCase())
      .filter(p => p.length > 0);

    if (selfPatterns.length > 0) {
      const internalTypes = new Set(['STANDING ORDER', 'TRANSFER']);
      for (const tx of transactions) {
        if (consumed.has(tx.id)) continue;
        if (!internalTypes.has(tx.type.toUpperCase())) continue;

        const desc = (tx.description ?? '').toLowerCase();
        const particulars = (tx.particulars ?? '').toLowerCase();
        const haystack = `${desc} ${particulars}`;
        const matched = selfPatterns.some(p => haystack.includes(p));
        if (matched) {
          result.set(tx.id, { isInternal: true, reason: 'self-pattern' });
        }
      }
    }

    return result;
  }

  /**
   * Convenience: applies annotations and returns the transactions with
   * internal items removed. Callers that need to display annotations should
   * use annotate() directly.
   */
  filterOutInternal(
    transactions: FormattedTransaction[],
    options: DetectionOptions = {}
  ): FormattedTransaction[] {
    const annotations = this.annotate(transactions, options);
    return transactions.filter(tx => !annotations.get(tx.id)?.isInternal);
  }

  /**
   * Returns a summary of detected internal transactions, useful for debug
   * output ("X transactions filtered as internal").
   */
  summarize(
    transactions: FormattedTransaction[],
    annotations: Map<string, InternalAnnotation>
  ): { count: number; absTotal: number } {
    let count = 0;
    let absTotal = 0;
    for (const tx of transactions) {
      if (annotations.get(tx.id)?.isInternal) {
        count++;
        absTotal += Math.abs(tx.amount);
      }
    }
    // Divide by 2 to count pair as one move (a pair has 2 legs of equal magnitude)
    return { count, absTotal: absTotal / 2 };
  }
}

export const internalTransferService = new InternalTransferService();
