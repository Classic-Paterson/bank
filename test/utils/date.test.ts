import {expect} from 'chai'
import {
  parseDate,
  validateDateRange,
  formatDateISO,
  daysAgo,
  monthsAgo,
  validateAmountRange,
  parseDateRange,
} from '../../src/utils/date.js'

describe('date utilities', () => {
  describe('parseDate', () => {
    it('parses valid YYYY-MM-DD format', () => {
      const result = parseDate('2024-01-15', 'since')
      expect(result.success).to.be.true
      if (result.success) {
        expect(result.date.getFullYear()).to.equal(2024)
        expect(result.date.getMonth()).to.equal(0) // January is 0
        expect(result.date.getDate()).to.equal(15)
      }
    })

    it('rejects invalid format (DD-MM-YYYY)', () => {
      const result = parseDate('15-01-2024', 'since')
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date format')
        expect(result.error).to.include('YYYY-MM-DD')
      }
    })

    it('rejects invalid format (slash separators)', () => {
      const result = parseDate('2024/01/15', 'since')
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date format')
      }
    })

    it('rejects incomplete date (YYYY-MM)', () => {
      const result = parseDate('2024-01', 'since')
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date format')
      }
    })

    it('rejects invalid date values (invalid month)', () => {
      const result = parseDate('2024-13-01', 'since')
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date')
      }
    })

    it('rejects invalid date values (invalid day)', () => {
      const result = parseDate('2024-02-30', 'since')
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date')
      }
    })

    it('includes field name in error message', () => {
      const result = parseDate('invalid', 'until')
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('--until')
      }
    })

    it('handles leap year dates correctly', () => {
      const result = parseDate('2024-02-29', 'since')
      expect(result.success).to.be.true // 2024 is a leap year
    })

    it('rejects Feb 29 on non-leap year', () => {
      const result = parseDate('2023-02-29', 'since')
      expect(result.success).to.be.false // 2023 is not a leap year
    })

    // Date shortcut tests
    describe('date shortcuts', () => {
      it('parses "today" as current date', () => {
        const result = parseDate('today', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(new Date()))
        }
      })

      it('parses "Today" (case insensitive)', () => {
        const result = parseDate('Today', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(new Date()))
        }
      })

      it('parses "yesterday" as one day ago', () => {
        const result = parseDate('yesterday', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(1)))
        }
      })

      it('parses "YESTERDAY" (case insensitive)', () => {
        const result = parseDate('YESTERDAY', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(1)))
        }
      })

      it('parses "7d" as 7 days ago', () => {
        const result = parseDate('7d', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(7)))
        }
      })

      it('parses "30days" as 30 days ago', () => {
        const result = parseDate('30days', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(30)))
        }
      })

      it('parses "14day" as 14 days ago (singular)', () => {
        const result = parseDate('14day', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(14)))
        }
      })

      it('parses "2w" as 2 weeks (14 days) ago', () => {
        const result = parseDate('2w', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(14)))
        }
      })

      it('parses "4weeks" as 4 weeks (28 days) ago', () => {
        const result = parseDate('4weeks', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(28)))
        }
      })

      it('parses "1week" as 1 week (7 days) ago (singular)', () => {
        const result = parseDate('1week', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(7)))
        }
      })

      it('parses "0d" as today', () => {
        const result = parseDate('0d', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(new Date()))
        }
      })

      // Month shortcuts
      it('parses "1m" as 1 month ago', () => {
        const result = parseDate('1m', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(monthsAgo(1)))
        }
      })

      it('parses "3months" as 3 months ago', () => {
        const result = parseDate('3months', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(monthsAgo(3)))
        }
      })

      it('parses "6month" as 6 months ago (singular)', () => {
        const result = parseDate('6month', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(monthsAgo(6)))
        }
      })

      it('parses "thismonth" as first day of current month', () => {
        const result = parseDate('thismonth', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear(), now.getMonth(), 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "THISMONTH" (case insensitive)', () => {
        const result = parseDate('THISMONTH', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear(), now.getMonth(), 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "lastmonth" as first day of previous month', () => {
        const result = parseDate('lastmonth', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "endoflastmonth" as last day of previous month', () => {
        const result = parseDate('endoflastmonth', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          // Day 0 of current month = last day of previous month
          const expected = new Date(now.getFullYear(), now.getMonth(), 0)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('error message mentions shortcuts for invalid input', () => {
        const result = parseDate('baddate', 'since')
        expect(result.success).to.be.false
        if (!result.success) {
          expect(result.error).to.include('today')
          expect(result.error).to.include('yesterday')
          expect(result.error).to.include('7d')
          expect(result.error).to.include('thismonth')
          expect(result.error).to.include('lastmonth')
        }
      })
    })
  })

  describe('validateDateRange', () => {
    it('accepts valid range (start before end)', () => {
      const start = new Date('2024-01-01')
      const end = new Date('2024-01-31')
      const result = validateDateRange(start, end)
      expect(result.success).to.be.true
    })

    it('accepts same day range', () => {
      const date = new Date('2024-01-15')
      const result = validateDateRange(date, date)
      expect(result.success).to.be.true
    })

    it('rejects invalid range (start after end)', () => {
      const start = new Date('2024-12-31')
      const end = new Date('2024-01-01')
      const result = validateDateRange(start, end)
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date range')
        expect(result.error).to.include('after')
      }
    })

    it('uses custom labels in error message', () => {
      const start = new Date('2024-12-31')
      const end = new Date('2024-01-01')
      const result = validateDateRange(start, end, 'from', 'to')
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('--from')
        expect(result.error).to.include('--to')
      }
    })
  })

  describe('formatDateISO', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date('2024-03-15T12:00:00Z')
      const result = formatDateISO(date)
      expect(result).to.equal('2024-03-15')
    })

    it('pads single-digit month and day', () => {
      const date = new Date('2024-01-05T12:00:00Z')
      const result = formatDateISO(date)
      expect(result).to.equal('2024-01-05')
    })
  })

  describe('daysAgo', () => {
    it('returns date N days in the past', () => {
      const result = daysAgo(7)
      const now = new Date()
      const expectedDate = new Date()
      expectedDate.setDate(now.getDate() - 7)

      // Compare date strings to avoid time precision issues
      expect(formatDateISO(result)).to.equal(formatDateISO(expectedDate))
    })

    it('handles 0 days (returns today)', () => {
      const result = daysAgo(0)
      const now = new Date()
      expect(formatDateISO(result)).to.equal(formatDateISO(now))
    })

    it('handles large number of days', () => {
      const result = daysAgo(365)
      const now = new Date()
      const expectedDate = new Date()
      expectedDate.setDate(now.getDate() - 365)
      expect(formatDateISO(result)).to.equal(formatDateISO(expectedDate))
    })
  })

  describe('monthsAgo', () => {
    it('returns date N months in the past', () => {
      const result = monthsAgo(1)
      const expected = new Date()
      expected.setMonth(expected.getMonth() - 1)
      expect(formatDateISO(result)).to.equal(formatDateISO(expected))
    })

    it('handles 0 months (returns today)', () => {
      const result = monthsAgo(0)
      const now = new Date()
      expect(formatDateISO(result)).to.equal(formatDateISO(now))
    })

    it('handles crossing year boundary', () => {
      const result = monthsAgo(12)
      const expected = new Date()
      expected.setMonth(expected.getMonth() - 12)
      expect(formatDateISO(result)).to.equal(formatDateISO(expected))
    })

    it('handles multiple year spans', () => {
      const result = monthsAgo(24)
      const expected = new Date()
      expected.setMonth(expected.getMonth() - 24)
      expect(formatDateISO(result)).to.equal(formatDateISO(expected))
    })
  })

  describe('validateAmountRange', () => {
    it('accepts valid range (min < max)', () => {
      const result = validateAmountRange(100, 500)
      expect(result.success).to.be.true
    })

    it('accepts equal min and max', () => {
      const result = validateAmountRange(100, 100)
      expect(result.success).to.be.true
    })

    it('accepts undefined values', () => {
      expect(validateAmountRange(undefined, undefined).success).to.be.true
      expect(validateAmountRange(100, undefined).success).to.be.true
      expect(validateAmountRange(undefined, 500).success).to.be.true
    })

    it('accepts zero values', () => {
      expect(validateAmountRange(0, 100).success).to.be.true
      expect(validateAmountRange(0, 0).success).to.be.true
    })

    it('rejects negative minAmount', () => {
      const result = validateAmountRange(-100, 500)
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('--minAmount')
        expect(result.error).to.include('non-negative')
      }
    })

    it('rejects negative maxAmount', () => {
      const result = validateAmountRange(100, -50)
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('--maxAmount')
        expect(result.error).to.include('non-negative')
      }
    })

    it('rejects min greater than max', () => {
      const result = validateAmountRange(500, 100)
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid amount range')
        expect(result.error).to.include('greater than')
      }
    })
  })

  describe('parseDateRange', () => {
    it('uses default days back when no flags provided', () => {
      const result = parseDateRange({
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.true
      if (result.success) {
        const expectedStart = daysAgo(7)
        expect(result.startDate).to.equal(formatDateISO(expectedStart))
      }
    })

    it('uses --since when provided', () => {
      const result = parseDateRange({
        since: '2024-01-01',
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.true
      if (result.success) {
        expect(result.startDate).to.equal('2024-01-01')
      }
    })

    it('--days takes precedence over --since', () => {
      const result = parseDateRange({
        since: '2024-01-01',
        days: 3,
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.true
      if (result.success) {
        const expectedStart = daysAgo(3)
        expect(result.startDate).to.equal(formatDateISO(expectedStart))
      }
    })

    it('uses --until when provided', () => {
      const result = parseDateRange({
        since: '2024-01-01',
        until: '2024-01-31',
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.true
      if (result.success) {
        expect(result.endDate).to.equal('2024-01-31')
      }
    })

    it('defaults end date to today', () => {
      const result = parseDateRange({
        since: '2024-01-01',
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.true
      if (result.success) {
        expect(result.endDate).to.equal(formatDateISO(new Date()))
      }
    })

    it('extends same-day range when option enabled', () => {
      const today = formatDateISO(new Date())
      const result = parseDateRange({
        since: today,
        until: today,
        defaultDaysBack: 7,
        extendSameDayRange: true,
      })
      expect(result.success).to.be.true
      if (result.success) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        expect(result.endDate).to.equal(formatDateISO(tomorrow))
      }
    })

    it('does not extend same-day range by default', () => {
      const today = formatDateISO(new Date())
      const result = parseDateRange({
        since: today,
        until: today,
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.true
      if (result.success) {
        expect(result.startDate).to.equal(result.endDate)
      }
    })

    it('returns error for invalid since date', () => {
      const result = parseDateRange({
        since: 'invalid',
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date format')
      }
    })

    it('returns error for invalid until date', () => {
      const result = parseDateRange({
        until: 'invalid',
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date format')
      }
    })

    it('returns error when since is after until', () => {
      const result = parseDateRange({
        since: '2024-12-31',
        until: '2024-01-01',
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('Invalid date range')
      }
    })

    it('rejects --days value of 0', () => {
      const result = parseDateRange({
        days: 0,
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('--days')
        expect(result.error).to.include('at least 1')
      }
    })

    it('rejects negative --days value', () => {
      const result = parseDateRange({
        days: -5,
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.false
      if (!result.success) {
        expect(result.error).to.include('--days')
        expect(result.error).to.include('at least 1')
      }
    })

    it('accepts --days value of 1', () => {
      const result = parseDateRange({
        days: 1,
        defaultDaysBack: 7,
      })
      expect(result.success).to.be.true
    })
  })
})
