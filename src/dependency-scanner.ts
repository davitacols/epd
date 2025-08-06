import fs from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { execSync } from "child_process"
import { promisify } from "util"
// import semver from "semver"
import { ScanOptions, ScanResult, PackageJson, PackageInfo, ScanReport } from "./types"

// Import glob with fallback
let globPromise: any

try {
  const { glob } = await import("glob")
  globPromise = glob
} catch (error) {
  // Fallback implementation without glob
  globPromise = async (pattern: string, options: any) => {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Simple recursive file finder
    async function findFiles(dir: string, ext: string): Promise<string[]> {
      const files: string[] = []
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory() && !entry.name.includes('node_modules')) {
            files.push(...await findFiles(fullPath, ext))
          } else if (entry.isFile() && entry.name.endsWith(ext)) {
            files.push(fullPath)
          }
        }
      } catch (e) {}
      return files
    }
    
    const ext = pattern.replace('**/*', '')
    return findFiles(options.cwd || process.cwd(), ext)
  }
}

// Common file extensions to scan
const FILE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".mjs", ".cjs", ".mts", ".cts"]

// Files and directories to ignore
const IGNORE_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.git/**"]

// Special dependencies that might not be directly imported
const SPECIAL_DEPENDENCIES = new Set([
  "webpack", "babel", "eslint", "prettier", "typescript", "jest", "mocha", "chai"
])

/**
 * Scans the codebase to identify unused dependencies
 */
export async function scanUnusedDependencies(options: ScanOptions = {}): Promise<ScanResult> {
  const {
    directory = process.cwd(),
    includeDevDependencies = true,
    includePeerDependencies = false,
    includeOptionalDependencies = false,
    ignoreSpecialDependencies = true,
    verbose = false,
  } = options

  console.log("🔍 Scanning codebase for unused dependencies...")

  try {
    // Step 1: Read package.json to get dependencies
    const packageJson = await readPackageJsonFile(directory)
    const declaredDependencies = getDeclaredDependenciesFromPackage(
      packageJson,
      includeDevDependencies,
      includePeerDependencies,
      includeOptionalDependencies,
    )

    if (verbose) {
      console.log(`📦 Found ${Object.keys(declaredDependencies).length} declared dependencies`)
    }

    // Step 2: Find all source files
    const sourceFiles = await findAllSourceFiles(directory)

    if (verbose) {
      console.log(`📄 Found ${sourceFiles.length} source files to scan`)
    }

    // Step 3: Scan files for imports/requires
    const usedDependencies = await findDependenciesInFiles(sourceFiles, directory)

    if (verbose) {
      console.log(`🔗 Found ${usedDependencies.size} dependencies used in code`)
    }

    // Step 4: Check for dependencies used in scripts
    const scriptDependencies = findDependenciesInScripts(packageJson)
    scriptDependencies.forEach((dep) => usedDependencies.add(dep))

    // Step 5: Identify unused dependencies
    const unusedDependencies: Record<string, PackageInfo> = {}
    const potentiallyUnusedDependencies: Record<string, PackageInfo> = {}

    for (const [name, info] of Object.entries(declaredDependencies)) {
      if (!usedDependencies.has(name)) {
        if (ignoreSpecialDependencies && SPECIAL_DEPENDENCIES.has(name)) {
          potentiallyUnusedDependencies[name] = info
        } else {
          unusedDependencies[name] = info
        }
      }
    }

    return {
      unused: unusedDependencies,
      potentiallyUnused: potentiallyUnusedDependencies,
      total: Object.keys(declaredDependencies).length,
      scannedFiles: sourceFiles.length,
    }
  } catch (error) {
    console.error("❌ Error scanning for unused dependencies:", error)
    throw error
  }
}

async function readPackageJsonFile(directory: string): Promise<PackageJson> {
  const packageJsonPath = path.join(directory, "package.json")
  const content = await fs.readFile(packageJsonPath, "utf-8")
  return JSON.parse(content)
}

function getDeclaredDependenciesFromPackage(
  packageJson: PackageJson,
  includeDevDependencies: boolean,
  includePeerDependencies: boolean,
  includeOptionalDependencies: boolean,
): Record<string, PackageInfo> {
  const dependencies: Record<string, PackageInfo> = {}

  // Regular dependencies
  if (packageJson.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      dependencies[name] = { version, type: "dependency" }
    }
  }

  // Dev dependencies
  if (includeDevDependencies && packageJson.devDependencies) {
    for (const [name, version] of Object.entries(packageJson.devDependencies)) {
      dependencies[name] = { version, type: "devDependency" }
    }
  }

  // Peer dependencies
  if (includePeerDependencies && packageJson.peerDependencies) {
    for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
      dependencies[name] = { version, type: "peerDependency" }
    }
  }

  // Optional dependencies
  if (includeOptionalDependencies && packageJson.optionalDependencies) {
    for (const [name, version] of Object.entries(packageJson.optionalDependencies)) {
      dependencies[name] = { version, type: "optionalDependency" }
    }
  }

  return dependencies
}

async function findAllSourceFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  
  for (const ext of FILE_EXTENSIONS) {
    try {
      const matches = await globPromise(`**/*${ext}`, {
        cwd: directory,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      })
      files.push(...matches)
    } catch (error) {
      // Continue if pattern fails
    }
  }
  
  return [...new Set(files)]
}

async function findDependenciesInFiles(files: string[], directory: string): Promise<Set<string>> {
  const dependencies = new Set<string>()
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8")
      const fileDeps = extractDependenciesFromContent(content)
      fileDeps.forEach(dep => dependencies.add(dep))
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  return dependencies
}

function extractDependenciesFromContent(content: string): string[] {
  const dependencies: string[] = []
  
  // Match import statements
  const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
  // Match require statements
  const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  
  let match
  while ((match = importRegex.exec(content)) !== null) {
    const dep = extractPackageName(match[1])
    if (dep) dependencies.push(dep)
  }
  
  while ((match = requireRegex.exec(content)) !== null) {
    const dep = extractPackageName(match[1])
    if (dep) dependencies.push(dep)
  }
  
  return dependencies
}

function extractPackageName(importPath: string): string | null {
  // Skip relative imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null
  }
  
  // Handle scoped packages
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0]
  }
  
  // Handle regular packages
  return importPath.split('/')[0]
}

function findDependenciesInScripts(packageJson: PackageJson): Set<string> {
  const dependencies = new Set<string>()
  
  if (packageJson.scripts) {
    for (const script of Object.values(packageJson.scripts)) {
      // Simple extraction of command names from scripts
      const commands = script.split(/[;&|]/).map(cmd => cmd.trim().split(' ')[0])
      commands.forEach(cmd => {
        if (cmd && !cmd.startsWith('./') && !cmd.startsWith('npm') && !cmd.startsWith('node')) {
          dependencies.add(cmd)
        }
      })
    }
  }
  
  return dependencies
}

export function generateUnusedDependenciesReport(result: ScanResult): ScanReport {
  const report: ScanReport = {
    unusedCount: Object.keys(result.unused).length,
    potentiallyUnusedCount: Object.keys(result.potentiallyUnused).length,
    totalDependencies: result.total,
    filesScanned: result.scannedFiles,
  }

  console.log(`\n📊 Dependency Scan Report:`)
  console.log(`   Total dependencies: ${report.totalDependencies}`)
  console.log(`   Files scanned: ${report.filesScanned}`)
  console.log(`   Unused dependencies: ${report.unusedCount}`)
  console.log(`   Potentially unused: ${report.potentiallyUnusedCount}`)

  if (report.unusedCount > 0) {
    console.log(`\n🗑️  Unused dependencies:`)
    for (const [name, info] of Object.entries(result.unused)) {
      console.log(`   - ${name} (${info.type})`)
    }
  }

  if (report.potentiallyUnusedCount > 0) {
    console.log(`\n⚠️  Potentially unused dependencies:`)
    for (const [name, info] of Object.entries(result.potentiallyUnused)) {
      console.log(`   - ${name} (${info.type})`)
    }
  }

  return report
}

export async function calculateDiskSpaceSavings(unusedDeps: Record<string, PackageInfo>, directory: string): Promise<number> {
  // Simplified calculation - in reality would need to check node_modules sizes
  return Object.keys(unusedDeps).length * 0.5 // Rough estimate of 0.5MB per package
}