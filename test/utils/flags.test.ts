import {expect} from 'chai'
import {checkMutuallyExclusiveFlags} from '../../src/utils/flags.js'

describe('flags utilities', () => {
  describe('checkMutuallyExclusiveFlags', () => {
    it('returns null when no flags are set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', false],
        ['--total', false],
        ['--merchants', false],
      ])
      expect(result).to.be.null
    })

    it('returns null when exactly one flag is set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--total', false],
        ['--merchants', false],
      ])
      expect(result).to.be.null
    })

    it('returns error message when two flags are set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--total', true],
        ['--merchants', false],
      ])
      expect(result).to.equal('Cannot use --count and --total together. Use only one.')
    })

    it('returns error message with Oxford comma when three flags are set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--total', true],
        ['--merchants', true],
      ])
      expect(result).to.equal('Cannot use --count, --total, and --merchants together. Use only one.')
    })

    it('handles numeric flags (like --top) where undefined means not set', () => {
      // When --top is undefined, it's not set
      const resultNotSet = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--top', undefined],
      ])
      expect(resultNotSet).to.be.null

      // When --top is a number (even 0), it's set
      const resultWithZero = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--top', 0],
      ])
      expect(resultWithZero).to.equal('Cannot use --count and --top together. Use only one.')

      const resultWithPositive = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--top', 10],
      ])
      expect(resultWithPositive).to.equal('Cannot use --count and --top together. Use only one.')
    })

    it('treats false booleans as not set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', false],
        ['--total', true],
      ])
      expect(result).to.be.null
    })

    it('adds -- prefix to flag names if missing', () => {
      const result = checkMutuallyExclusiveFlags([
        ['count', true],
        ['total', true],
      ])
      expect(result).to.equal('Cannot use --count and --total together. Use only one.')
    })

    it('does not duplicate -- prefix if already present', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--total', true],
      ])
      expect(result).to.contain('--count')
      expect(result).not.to.contain('----')
    })

    it('handles string flags as truthy values', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--format', 'json'],
        ['--output', 'file.txt'],
      ])
      expect(result).to.equal('Cannot use --format and --output together. Use only one.')
    })

    it('handles empty string as not set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--merchant', ''],
      ])
      expect(result).to.be.null
    })

    it('handles null values as not set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', true],
        ['--total', null],
      ])
      expect(result).to.be.null
    })

    it('handles four or more flags in error message', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--a', true],
        ['--b', true],
        ['--c', true],
        ['--d', true],
      ])
      expect(result).to.equal('Cannot use --a, --b, --c, and --d together. Use only one.')
    })

    it('returns null for empty array input', () => {
      const result = checkMutuallyExclusiveFlags([])
      expect(result).to.be.null
    })

    it('returns null for single entry that is set', () => {
      const result = checkMutuallyExclusiveFlags([
        ['--count', true],
      ])
      expect(result).to.be.null
    })
  })
})
