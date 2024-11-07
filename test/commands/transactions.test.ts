import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('transactions', () => {
  it('runs transactions cmd', async () => {
    const {stdout} = await runCommand('transactions')
    expect(stdout).to.contain('hello world')
  })

  it('runs transactions --name oclif', async () => {
    const {stdout} = await runCommand('transactions --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
