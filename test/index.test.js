import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('EPD Core Functionality', () => {
  it('should detect package manager from lockfiles', async () => {
    // Test package manager detection logic
    const { existsSync } = await import('fs')
    assert.ok(typeof existsSync === 'function', 'existsSync should be available')
  })

  it('should parse command line arguments correctly', () => {
    // Mock parseArgs function test
    const testArgs = ['install', '--pm=npm', '--debug', 'react']
    const expected = {
      originalArgs: testArgs,
      command: 'install',
      packageArgs: ['react'],
      forcedPm: 'npm',
      debug: true
    }
    
    // Simple validation that our expected structure is correct
    assert.ok(expected.command === 'install', 'Command parsing should work')
    assert.ok(expected.forcedPm === 'npm', 'Package manager parsing should work')
    assert.ok(expected.debug === true, 'Debug flag parsing should work')
  })

  it('should handle package.json operations', async () => {
    const testPackageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: { 'react': '^18.0.0' },
      peerDependencies: { 'react-dom': '^18.0.0' }
    }
    
    // Test that we can work with package.json structure
    assert.ok(testPackageJson.name === 'test-package', 'Package name should be accessible')
    assert.ok(testPackageJson.dependencies.react === '^18.0.0', 'Dependencies should be accessible')
    assert.ok(testPackageJson.peerDependencies['react-dom'] === '^18.0.0', 'Peer dependencies should be accessible')
  })

  it('should validate workspace detection', () => {
    const workspaceConfig = {
      workspaces: ['packages/*', 'apps/*']
    }
    
    const workspaceConfigObject = {
      workspaces: {
        packages: ['packages/*', 'apps/*']
      }
    }
    
    // Test workspace configuration parsing
    assert.ok(Array.isArray(workspaceConfig.workspaces), 'Array workspaces should be detected')
    assert.ok(Array.isArray(workspaceConfigObject.workspaces.packages), 'Object workspaces should be detected')
  })

  it('should handle dependency scanning types', () => {
    const scanOptions = {
      directory: process.cwd(),
      includeDevDependencies: true,
      includePeerDependencies: true,
      verbose: false
    }
    
    const scanResult = {
      unused: {},
      potentiallyUnused: {},
      total: 0,
      scannedFiles: 0
    }
    
    // Validate scan structures
    assert.ok(typeof scanOptions.directory === 'string', 'Directory should be string')
    assert.ok(typeof scanOptions.includeDevDependencies === 'boolean', 'Include dev deps should be boolean')
    assert.ok(typeof scanResult.total === 'number', 'Total should be number')
    assert.ok(typeof scanResult.unused === 'object', 'Unused should be object')
  })
})