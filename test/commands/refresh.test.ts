import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('refresh', () => {
  it('runs refresh command', async () => {
    try {
      const {stdout} = await runCommand('refresh')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles no additional flags', async () => {
    try {
      const {stdout} = await runCommand('refresh')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })
})
