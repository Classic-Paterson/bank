import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('accounts', () => {
  it('runs accounts cmd', async () => {
    const {stdout} = await runCommand('accounts')
    expect(stdout).to.contain('hello world')
  })

  it('runs accounts --name oclif', async () => {
    const {stdout} = await runCommand('accounts --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
