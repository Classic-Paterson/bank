import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('refresh', () => {
  it('runs refresh cmd', async () => {
    const {stdout} = await runCommand('refresh')
    expect(stdout).to.contain('hello world')
  })

  it('runs refresh --name oclif', async () => {
    const {stdout} = await runCommand('refresh --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
