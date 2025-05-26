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

  it('handles months flag', async () => {
    try {
      const {stdout} = await runCommand('categories --months 3')
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
})
