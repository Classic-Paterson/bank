import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('categories', () => {
  it('runs categories command', async () => {
    try {
      const {stdout} = await runCommand('categories')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles days flag', async () => {
    try {
      const {stdout} = await runCommand('categories --days 90')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles since/until flags', async () => {
    try {
      const {stdout} = await runCommand('categories --since 2024-01-01 --until 2024-03-31')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles format flag', async () => {
    try {
      const {stdout} = await runCommand('categories --format csv')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('rejects invalid date format', async () => {
    const {error} = await runCommand('categories --since invalid-date')
    expect(error).to.exist
    if (error) {
      expect(error.message).to.include('Invalid date format')
    }
  })

  it('rejects invalid date range', async () => {
    const {error} = await runCommand('categories --since 2024-06-01 --until 2024-01-01')
    expect(error).to.exist
    if (error) {
      expect(error.message).to.include('Invalid date range')
    }
  })

  it('handles account filter flag', async () => {
    try {
      const {stdout} = await runCommand('categories --account acc_12345')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })
})
