import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('categories', () => {
  it('runs categories cmd', async () => {
    const {stdout} = await runCommand('categories')
    expect(stdout).to.contain('hello world')
  })

  it('runs categories --name oclif', async () => {
    const {stdout} = await runCommand('categories --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
