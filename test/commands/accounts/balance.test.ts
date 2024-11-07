import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('accounts:balance', () => {
  it('runs accounts:balance cmd', async () => {
    const {stdout} = await runCommand('accounts:balance')
    expect(stdout).to.contain('hello world')
  })

  it('runs accounts:balance --name oclif', async () => {
    const {stdout} = await runCommand('accounts:balance --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
