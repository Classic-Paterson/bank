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

      // "N days/weeks/months ago" natural language patterns
      it('parses "7 days ago" as 7 days ago', () => {
        const result = parseDate('7 days ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(7)))
        }
      })

      it('parses "30 days ago" as 30 days ago', () => {
        const result = parseDate('30 days ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(30)))
        }
      })

      it('parses "1 day ago" as yesterday (singular)', () => {
        const result = parseDate('1 day ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(1)))
        }
      })

      it('parses "2 weeks ago" as 14 days ago', () => {
        const result = parseDate('2 weeks ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(14)))
        }
      })

      it('parses "1 week ago" as 7 days ago (singular)', () => {
        const result = parseDate('1 week ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(7)))
        }
      })

      it('parses "3 months ago" as 3 months ago', () => {
        const result = parseDate('3 months ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(monthsAgo(3)))
        }
      })

      it('parses "1 month ago" as 1 month ago (singular)', () => {
        const result = parseDate('1 month ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(monthsAgo(1)))
        }
      })

      it('parses "7 DAYS AGO" (case insensitive)', () => {
        const result = parseDate('7 DAYS AGO', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(7)))
        }
      })

      it('parses "2 Weeks Ago" (mixed case)', () => {
        const result = parseDate('2 Weeks Ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(daysAgo(14)))
        }
      })

      it('parses "3 Months Ago" (mixed case)', () => {
        const result = parseDate('3 Months Ago', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          expect(formatDateISO(result.date)).to.equal(formatDateISO(monthsAgo(3)))
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

      it('parses "endofthismonth" as last day of current month', () => {
        const result = parseDate('endofthismonth', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          // Day 0 of next month = last day of current month
          const expected = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "endoflastweek" as last Sunday of previous week', () => {
        const result = parseDate('endoflastweek', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const dayOfWeek = now.getDay()
          // Sunday is 0, so last Sunday is (dayOfWeek) days ago if today is not Sunday,
          // or 7 days ago if today is Sunday
          const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek
          const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastSunday)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "ENDOFLASTWEEK" (case insensitive)', () => {
        const result = parseDate('ENDOFLASTWEEK', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const dayOfWeek = now.getDay()
          const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek
          const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastSunday)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "endofthisweek" as Sunday of current week', () => {
        const result = parseDate('endofthisweek', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const dayOfWeek = now.getDay()
          // Sunday is 0. We want the upcoming Sunday (or today if it's Sunday)
          const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
          const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "ENDOFTHISWEEK" (case insensitive)', () => {
        const result = parseDate('ENDOFTHISWEEK', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const dayOfWeek = now.getDay()
          const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
          const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday)
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
          expect(result.error).to.include('7 days ago')
          expect(result.error).to.include('2 weeks ago')
          expect(result.error).to.include('3 months ago')
          expect(result.error).to.include('thismonth')
          expect(result.error).to.include('thisquarter')
        }
      })

      // Week shortcuts
      it('parses "thisweek" as first day of current week (Monday)', () => {
        const result = parseDate('thisweek', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const dayOfWeek = now.getDay()
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "lastweek" as first day of previous week (Monday)', () => {
        const result = parseDate('lastweek', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const dayOfWeek = now.getDay()
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract - 7)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      // Quarter shortcuts
      it('parses "thisquarter" as first day of current quarter', () => {
        const result = parseDate('thisquarter', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const expected = new Date(now.getFullYear(), quarterStartMonth, 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "lastquarter" as first day of previous quarter', () => {
        const result = parseDate('lastquarter', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const lastQuarterStartMonth = currentQuarterStartMonth - 3
          const year = lastQuarterStartMonth < 0 ? now.getFullYear() - 1 : now.getFullYear()
          const month = lastQuarterStartMonth < 0 ? lastQuarterStartMonth + 12 : lastQuarterStartMonth
          const expected = new Date(year, month, 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "endofthisquarter" as last day of current quarter', () => {
        const result = parseDate('endofthisquarter', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          // Last day of quarter = day 0 of first month of next quarter
          const expected = new Date(now.getFullYear(), quarterStartMonth + 3, 0)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "ENDOFTHISQUARTER" (case insensitive)', () => {
        const result = parseDate('ENDOFTHISQUARTER', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const expected = new Date(now.getFullYear(), quarterStartMonth + 3, 0)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "endoflastquarter" as last day of previous quarter', () => {
        const result = parseDate('endoflastquarter', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          // Last day of previous quarter = day 0 of current quarter start month
          const expected = new Date(now.getFullYear(), currentQuarterStartMonth, 0)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "ENDOFLASTQUARTER" (case insensitive)', () => {
        const result = parseDate('ENDOFLASTQUARTER', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const expected = new Date(now.getFullYear(), currentQuarterStartMonth, 0)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      // Year shortcuts
      it('parses "thisyear" as first day of current year', () => {
        const result = parseDate('thisyear', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear(), 0, 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "lastyear" as first day of previous year', () => {
        const result = parseDate('lastyear', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear() - 1, 0, 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "endofthisyear" as last day of current year (Dec 31)', () => {
        const result = parseDate('endofthisyear', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear(), 11, 31)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "ENDOFTHISYEAR" (case insensitive)', () => {
        const result = parseDate('ENDOFTHISYEAR', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear(), 11, 31)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "endoflastyear" as last day of previous year (Dec 31)', () => {
        const result = parseDate('endoflastyear', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear() - 1, 11, 31)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "ENDOFLASTYEAR" (case insensitive)', () => {
        const result = parseDate('ENDOFLASTYEAR', 'until')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const expected = new Date(now.getFullYear() - 1, 11, 31)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
        }
      })

      it('parses "THISQUARTER" (case insensitive)', () => {
        const result = parseDate('THISQUARTER', 'since')
        expect(result.success).to.be.true
        if (result.success) {
          const now = new Date()
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const expected = new Date(now.getFullYear(), quarterStartMonth, 1)
          expect(formatDateISO(result.date)).to.equal(formatDateISO(expected))
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

    it('calls onWarning when both --days and --since are provided', () => {
      let warningMessage: string | undefined
      const result = parseDateRange({
        since: '2024-01-01',
        days: 3,
        defaultDaysBack: 7,
        onWarning: (msg) => {
          warningMessage = msg
        },
      })
      expect(result.success).to.be.true
      expect(warningMessage).to.be.a('string')
      expect(warningMessage).to.include('--days')
      expect(warningMessage).to.include('--since')
      expect(warningMessage).to.include('ignoring')
    })

    it('does not call onWarning when only --days is provided', () => {
      let warningCalled = false
      const result = parseDateRange({
        days: 3,
        defaultDaysBack: 7,
        onWarning: () => {
          warningCalled = true
        },
      })
      expect(result.success).to.be.true
      expect(warningCalled).to.be.false
    })

    it('does not call onWarning when only --since is provided', () => {
      let warningCalled = false
      const result = parseDateRange({
        since: '2024-01-01',
        defaultDaysBack: 7,
        onWarning: () => {
          warningCalled = true
        },
      })
      expect(result.success).to.be.true
      expect(warningCalled).to.be.false
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
