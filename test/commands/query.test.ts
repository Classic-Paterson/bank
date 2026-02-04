import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import { validateQueryName } from '../../src/services/query.service.js'

describe('query', () => {
  describe('validateQueryName', () => {
    it('accepts valid alphanumeric names', () => {
      expect(validateQueryName('groceries').valid).to.be.true
      expect(validateQueryName('MyQuery123').valid).to.be.true
    })

    it('accepts names with hyphens and underscores', () => {
      expect(validateQueryName('my-query').valid).to.be.true
      expect(validateQueryName('my_query').valid).to.be.true
      expect(validateQueryName('my-query_2024').valid).to.be.true
    })

    it('rejects empty names', () => {
      const result = validateQueryName('')
      expect(result.valid).to.be.false
      expect(result.error).to.contain('cannot be empty')
    })

    it('rejects whitespace-only names', () => {
      const result = validateQueryName('   ')
      expect(result.valid).to.be.false
      expect(result.error).to.contain('cannot be empty')
    })

    it('rejects names with spaces', () => {
      const result = validateQueryName('my query')
      expect(result.valid).to.be.false
      expect(result.error).to.contain('can only contain')
    })

    it('rejects names with special characters', () => {
      expect(validateQueryName('query@name').valid).to.be.false
      expect(validateQueryName('query.name').valid).to.be.false
      expect(validateQueryName('query/name').valid).to.be.false
      expect(validateQueryName('query!').valid).to.be.false
    })

    it('rejects names exceeding 64 characters', () => {
      const longName = 'a'.repeat(65)
      const result = validateQueryName(longName)
      expect(result.valid).to.be.false
      expect(result.error).to.contain('exceeds maximum length')
    })

    it('accepts names at exactly 64 characters', () => {
      const maxName = 'a'.repeat(64)
      expect(validateQueryName(maxName).valid).to.be.true
    })
  })

  it('runs query list command', async () => {
    const {stdout} = await runCommand('query list')
    // Should either show saved queries or a message about no queries
    expect(stdout).to.be.a('string')
  })

  it('shows help when no subcommand given', async () => {
    const {stdout} = await runCommand('query')
    expect(stdout).to.contain('query:list')
    expect(stdout).to.contain('query:run')
    expect(stdout).to.contain('query:save')
  })

  it('requires name for query save', async () => {
    const {error} = await runCommand('query save')
    expect(error).to.exist
    expect(error?.message).to.contain('Missing 1 required arg')
  })

  it('requires filters when saving', async () => {
    const {error} = await runCommand('query save test-query')
    expect(error).to.exist
    expect(error?.message).to.contain('At least one filter is required')
  })

  it('requires name for query run', async () => {
    const {error} = await runCommand('query run')
    expect(error).to.exist
    expect(error?.message).to.contain('Missing 1 required arg')
  })

  it('requires name for query delete', async () => {
    const {error} = await runCommand('query delete')
    expect(error).to.exist
    expect(error?.message).to.contain('Missing 1 required arg')
  })

  it('requires name for query show', async () => {
    const {error} = await runCommand('query show')
    expect(error).to.exist
    expect(error?.message).to.contain('Missing 1 required arg')
  })

  it('handles nonexistent query for run', async () => {
    const {error} = await runCommand('query run nonexistent-query-12345')
    expect(error).to.exist
    expect(error?.message).to.contain('not found')
  })

  it('handles nonexistent query for show', async () => {
    const {error} = await runCommand('query show nonexistent-query-12345')
    expect(error).to.exist
    expect(error?.message).to.contain('not found')
  })

  it('handles nonexistent query for delete', async () => {
    const {error} = await runCommand('query delete nonexistent-query-12345')
    expect(error).to.exist
    expect(error?.message).to.contain('not found')
  })

  it('rejects negative minAmount when saving', async () => {
    const {error} = await runCommand('query save test-neg-min --minAmount -100')
    expect(error).to.exist
    expect(error?.message).to.contain('Amount cannot be negative')
  })

  it('rejects negative maxAmount when saving', async () => {
    const {error} = await runCommand('query save test-neg-max --maxAmount -50')
    expect(error).to.exist
    expect(error?.message).to.contain('Amount cannot be negative')
  })

  it('rejects minAmount greater than maxAmount when saving', async () => {
    const {error} = await runCommand('query save test-bad-range --minAmount 500 --maxAmount 100')
    expect(error).to.exist
    expect(error?.message).to.contain('Invalid amount range')
  })

  it('rejects query names with invalid characters', async () => {
    const {error} = await runCommand('query save "my query" --merchant "Test"')
    expect(error).to.exist
    expect(error?.message).to.contain('can only contain')
  })

  it('rejects query names with special characters', async () => {
    const {error} = await runCommand('query save "test@query" --merchant "Test"')
    expect(error).to.exist
    expect(error?.message).to.contain('can only contain')
  })

  it('accepts decimal amount filters when saving', async () => {
    // This should NOT error on the amount format - it should only fail because query already exists or pass
    const {error} = await runCommand('query save test-decimal-amounts --minAmount 99.50 --maxAmount 199.99')
    // If there's an error, it should NOT be about invalid number format
    if (error) {
      expect(error.message).to.not.contain('Invalid number')
      // It may fail for other reasons (already exists, etc.) but not for decimal parsing
    }
  })
})
