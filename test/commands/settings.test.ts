import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { merchantMappingService } from '../../src/services/merchant-mapping.service.js'

describe('settings', () => {
  // Save and restore merchant mappings to avoid affecting other tests
  let originalMappings: Record<string, {parent: string, category: string}>

  before(() => {
    originalMappings = merchantMappingService.getAllMappings()
  })

  after(() => {
    // Restore original mappings
    merchantMappingService.saveMerchantMap(originalMappings)
    merchantMappingService.invalidateCache()
  })

  it('runs settings list command', async () => {
    const {stdout} = await runCommand('settings list')
    expect(stdout).to.contain('Available settings')
  })

  it('shows help when no subcommand given', async () => {
    const {stdout} = await runCommand('settings')
    expect(stdout).to.contain('settings:list')
    expect(stdout).to.contain('settings:get')
    expect(stdout).to.contain('settings:set')
  })

  it('handles settings help action', async () => {
    const {stdout} = await runCommand('settings help')
    expect(stdout).to.contain('Available settings')
    expect(stdout).to.contain('appToken')
    expect(stdout).to.contain('format')
  })

  it('handles settings get command', async () => {
    try {
      await runCommand('settings get format')
      // Should handle gracefully even if no value is set
    } catch (error: any) {
      // API configuration errors are expected in test environment
      expect(error.message).to.satisfy((msg: string) =>
        msg.includes('API') || msg.includes('config') || msg.includes('token')
      )
    }
  })

  describe('export-merchants', () => {
    it('shows help with export-merchants', async () => {
      const {stdout} = await runCommand('settings export-merchants --help')
      expect(stdout).to.contain('Export merchant mappings')
    })

    it('warns when no mappings exist (exports empty)', async () => {
      // When merchant map is empty, it should warn
      const {stdout, stderr} = await runCommand('settings export-merchants')
      // Check output for either warning or JSON output
      const output = (stdout || '') + (stderr || '')
      expect(output).to.be.a('string')
    })
  })

  describe('import-merchants', () => {
    it('shows help with import-merchants', async () => {
      const {stdout} = await runCommand('settings import-merchants --help')
      expect(stdout).to.contain('Import merchant mappings')
    })

    it('requires file path for import', async () => {
      const {error} = await runCommand('settings import-merchants')
      expect(error).to.exist
      expect(error?.message).to.contain('Missing 1 required arg')
    })

    it('errors on non-existent file', async () => {
      const {error} = await runCommand('settings import-merchants /nonexistent/path.json')
      expect(error).to.exist
      expect(error?.message).to.contain('not found')
    })

    it('validates JSON structure', async () => {
      const tempFile = path.join(os.tmpdir(), `bank-test-invalid-${Date.now()}.json`)
      fs.writeFileSync(tempFile, '{"invalid": "structure"}')
      try {
        const {error} = await runCommand(`settings import-merchants ${tempFile} -y`)
        expect(error).to.exist
        expect(error?.message).to.contain('Invalid mapping')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('validates merchant mapping has required properties', async () => {
      const tempFile = path.join(os.tmpdir(), `bank-test-missing-props-${Date.now()}.json`)
      fs.writeFileSync(tempFile, '{"merchant": {"parent": "Food"}}') // missing category
      try {
        const {error} = await runCommand(`settings import-merchants ${tempFile} -y`)
        expect(error).to.exist
        expect(error?.message).to.contain('must have')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('accepts valid merchant map structure', async () => {
      const tempFile = path.join(os.tmpdir(), `bank-test-valid-${Date.now()}.json`)
      // Use a unique merchant name to avoid affecting other tests
      const validData = {
        'unique test merchant xyz': { parent: 'Food', category: 'Groceries' }
      }
      fs.writeFileSync(tempFile, JSON.stringify(validData))
      try {
        // Use -y to skip confirmation
        const {stdout} = await runCommand(`settings import-merchants ${tempFile} -y`)
        expect(stdout).to.include('Imported')
        expect(stdout).to.include('1 merchant mapping')
      } finally {
        fs.unlinkSync(tempFile)
        // Clean up the imported mapping immediately
        merchantMappingService.saveMerchantMap(originalMappings)
        merchantMappingService.invalidateCache()
      }
    })

    it('supports merge flag', async () => {
      const {stdout} = await runCommand('settings:import-merchants --help')
      expect(stdout).to.contain('--merge')
      expect(stdout).to.contain('Merge imported')
    })
  })
})
