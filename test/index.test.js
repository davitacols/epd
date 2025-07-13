import { describe, it } from 'node:test'
import assert from 'node:assert'
import { fileURLToPath } from 'url'
import path from 'path'
import { scanUnusedDependencies, generateUnusedDependenciesReport } from '../dependency-scanner.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Enhanced Peer Dependencies Tests', async () => {
  describe('scanUnusedDependencies', () => {
    it('should detect unused dependencies', async () => {
      const testDir = path.join(__dirname, 'fixtures/basic')
      const result = await scanUnusedDependencies({
        directory: testDir,
        includeDevDependencies: true,
        verbose: false
      })

      assert.ok(result.unused, 'Should return unused dependencies')
      assert.ok(result.potentiallyUnused, 'Should return potentially unused dependencies')
      assert.ok(result.total > 0, 'Should have total dependencies count')
      assert.ok(result.scannedFiles >= 0, 'Should have scanned files count')
    })
  })

  describe('generateUnusedDependenciesReport', () => {
    it('should generate a report for unused dependencies', () => {
      const mockResult = {
        unused: { 'test-pkg': { version: '1.0.0', type: 'dependency' } },
        potentiallyUnused: {},
        total: 1,
        scannedFiles: 1
      }

      const report = generateUnusedDependenciesReport(mockResult)

      assert.strictEqual(report.unusedCount, 1, 'Should have correct unused count')
      assert.strictEqual(report.potentiallyUnusedCount, 0, 'Should have correct potentially unused count')
      assert.strictEqual(report.totalDependencies, 1, 'Should have correct total dependencies')
      assert.strictEqual(report.filesScanned, 1, 'Should have correct files scanned')
    })
  })
})