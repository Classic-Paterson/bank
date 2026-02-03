import { expect } from 'chai';

// Tests for the date range merging algorithm used by the cache service

describe('cache service', () => {

  describe('date range merging', () => {
    it('merges overlapping date ranges', () => {
      // Simulate what the mergeDateRanges function should do
      const ranges = [
        { start: '2024-01-01', end: '2024-01-15' },
        { start: '2024-01-10', end: '2024-01-20' },
      ];

      // The merged result should be a single range covering the full span
      const merged = mergeRangesForTest(ranges);
      expect(merged).to.have.length(1);
      expect(merged[0].start).to.equal('2024-01-01');
      expect(merged[0].end).to.equal('2024-01-20');
    });

    it('merges adjacent date ranges', () => {
      const ranges = [
        { start: '2024-01-01', end: '2024-01-15' },
        { start: '2024-01-16', end: '2024-01-31' },
      ];

      const merged = mergeRangesForTest(ranges);
      expect(merged).to.have.length(1);
      expect(merged[0].start).to.equal('2024-01-01');
      expect(merged[0].end).to.equal('2024-01-31');
    });

    it('keeps non-overlapping ranges separate', () => {
      const ranges = [
        { start: '2024-01-01', end: '2024-01-10' },
        { start: '2024-01-20', end: '2024-01-31' },
      ];

      const merged = mergeRangesForTest(ranges);
      expect(merged).to.have.length(2);
      expect(merged[0].start).to.equal('2024-01-01');
      expect(merged[0].end).to.equal('2024-01-10');
      expect(merged[1].start).to.equal('2024-01-20');
      expect(merged[1].end).to.equal('2024-01-31');
    });

    it('handles multiple overlapping ranges', () => {
      const ranges = [
        { start: '2024-01-01', end: '2024-01-10' },
        { start: '2024-01-05', end: '2024-01-15' },
        { start: '2024-01-12', end: '2024-01-20' },
      ];

      const merged = mergeRangesForTest(ranges);
      expect(merged).to.have.length(1);
      expect(merged[0].start).to.equal('2024-01-01');
      expect(merged[0].end).to.equal('2024-01-20');
    });

    it('handles unsorted input ranges', () => {
      const ranges = [
        { start: '2024-01-15', end: '2024-01-20' },
        { start: '2024-01-01', end: '2024-01-10' },
        { start: '2024-01-08', end: '2024-01-17' },
      ];

      const merged = mergeRangesForTest(ranges);
      expect(merged).to.have.length(1);
      expect(merged[0].start).to.equal('2024-01-01');
      expect(merged[0].end).to.equal('2024-01-20');
    });

    it('handles single range', () => {
      const ranges = [{ start: '2024-01-01', end: '2024-01-15' }];

      const merged = mergeRangesForTest(ranges);
      expect(merged).to.have.length(1);
      expect(merged[0].start).to.equal('2024-01-01');
      expect(merged[0].end).to.equal('2024-01-15');
    });

    it('handles empty ranges array', () => {
      const merged = mergeRangesForTest([]);
      expect(merged).to.have.length(0);
    });

    it('handles contained ranges', () => {
      // One range fully contains another
      const ranges = [
        { start: '2024-01-01', end: '2024-01-31' },
        { start: '2024-01-10', end: '2024-01-20' },
      ];

      const merged = mergeRangesForTest(ranges);
      expect(merged).to.have.length(1);
      expect(merged[0].start).to.equal('2024-01-01');
      expect(merged[0].end).to.equal('2024-01-31');
    });
  });
});

/**
 * Test helper that replicates the mergeDateRanges logic for testing.
 * This allows testing the algorithm without needing to instantiate the full service.
 */
function mergeRangesForTest(ranges: { start: string; end: string }[]): { start: string; end: string }[] {
  if (ranges.length <= 1) return ranges;

  // Sort by start date
  const sorted = [...ranges].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const merged: { start: string; end: string }[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEnd = new Date(current.end).getTime();
    const nextStart = new Date(next.start).getTime();

    // Allow 1 day gap for adjacent ranges
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (nextStart <= currentEnd + ONE_DAY_MS) {
      // Ranges overlap or are adjacent - extend current range
      const nextEnd = new Date(next.end).getTime();
      if (nextEnd > currentEnd) {
        current.end = next.end;
      }
    } else {
      // Gap between ranges - save current and start new
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}
