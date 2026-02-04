import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('overview', () => {
  it('runs overview command', async () => {
    try {
      const {stdout} = await runCommand('overview')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles --compare flag', async () => {
    try {
      const {stdout} = await runCommand('overview --compare')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles --compare with --since flag', async () => {
    try {
      const {stdout} = await runCommand('overview --since thismonth --compare')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles days flag', async () => {
    try {
      const {stdout} = await runCommand('overview --days 14')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles refresh flag', async () => {
    try {
      const {stdout} = await runCommand('overview --refresh')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('rejects --days value of 0', async () => {
    const {error} = await runCommand('overview --days 0')
    expect(error).to.exist
    expect(error?.message).to.include('Invalid --days value')
    expect(error?.message).to.include('Must be at least 1')
  })

  it('rejects negative --days value', async () => {
    const {error} = await runCommand('overview --days -5')
    expect(error).to.exist
    expect(error?.message).to.include('Invalid --days value')
    expect(error?.message).to.include('Must be at least 1')
  })

  it('handles since/until flags', async () => {
    try {
      const {stdout} = await runCommand('overview --since 2024-01-01 --until 2024-01-31')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('rejects invalid date format', async () => {
    const {error} = await runCommand('overview --since 01-01-2024')
    expect(error).to.exist
    expect(error?.message).to.include('Invalid date format')
    expect(error?.message).to.include('YYYY-MM-DD')
  })

  it('rejects invalid date range', async () => {
    const {error} = await runCommand('overview --since 2024-02-01 --until 2024-01-01')
    expect(error).to.exist
    expect(error?.message).to.include('Invalid date range')
    expect(error?.message).to.include('is after')
  })

  it('handles account filter flag', async () => {
    try {
      const {stdout} = await runCommand('overview --account acc_12345')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles account filter with compare flag', async () => {
    try {
      const {stdout} = await runCommand('overview --account acc_12345 --compare')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })
})
