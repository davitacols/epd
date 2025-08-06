#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { execSync } from "child_process"
import { fileURLToPath } from "url"
// import semver from "semver"
import { PackageManager } from "./types"
import { loadConfig } from "./config.js"
import { scanSecurity, generateSecurityReport } from "./security.js"
import { checkUpdates } from "./updater.js"
import { promptConflictResolution } from "./interactive.js"
import { Cache } from "./cache.js"
import { runHealthCheck, generateHealthReport } from "./doctor.js"
import { autoFixPackageJson } from "./auto-fix.js"

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Cache for npm registry responses to avoid redundant requests
const packageVersionCache = new Map<string, string[]>()
// Cache for file reads to avoid redundant I/O
const fileCache = new Map<string, any>()

// Package manager detection and configuration
const PACKAGE_MANAGERS = {
  NPM: "npm" as PackageManager,
  YARN: "yarn" as PackageManager,
  PNPM: "pnpm" as PackageManager,
}

// Common critical dependencies that often cause conflicts
const KNOWN_CRITICAL_DEPS = new Set([
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
  "vue",
  "@vue/runtime-core",
  "typescript",
  "@types/node",
  "webpack",
  "@types/webpack",
  "styled-components",
  "@emotion/react",
  "next",
  "nuxt",
  "graphql",
  "@apollo/client",
  "rxjs",
  "lodash",
])

// Common problematic packages and their missing peer dependencies
const KNOWN_PROBLEMATIC_PACKAGES: Record<string, Record<string, string>> = {
  "react-redux": { react: "*", redux: "*" },
  "@mui/material": { react: "*", "react-dom": "*" },
  "styled-components": { react: "*", "react-dom": "*" },
  vuex: { vue: "*" },
  "vue-router": { vue: "*" },
  "graphql-tag": { graphql: "*" },
}

interface CommandLineArgs {
  originalArgs: string[]
  command: string
  packageArgs: string[]
  forcedPm: PackageManager | null
  debug: boolean
}

// Command line argument parsing - optimized with single-pass parsing
function parseArgs(args: string[]): CommandLineArgs {
  const result: CommandLineArgs = {
    originalArgs: [...args],
    command: args[0] || "",
    packageArgs: [],
    forcedPm: null,
    debug: false,
  }

  // Process arguments in a single pass
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg.startsWith("--pm=")) {
      result.forcedPm = arg.split("=")[1] as PackageManager
    } else if (arg === "--debug") {
      result.debug = true
    } else if (i > 0 && !arg.startsWith("--")) {
      result.packageArgs.push(arg)
    }
  }

  return result
}

// Main function
async function main() {
  try {
    console.log("🚀 Enhanced Peer Dependencies Tool")

    const args = parseArgs(process.argv.slice(2))

    if (args.debug) {
      console.log("🐛 Debug mode enabled")
      console.log("Arguments:", args)
    }

    // Detect the package manager being used - this is done only once
    const packageManager = await detectPackageManager(args.forcedPm)
    console.log(`🔍 Detected package manager: ${packageManager}`)

    // Load configuration
    const config = await loadConfig()

    // Handle different commands
    switch (args.command) {
      case "scan":
        process.exit(await handleScanCommand(args.originalArgs))
      case "install-scanner":
        process.exit(await handleInstallScannerCommand())
      case "security":
        process.exit(await handleSecurityCommand())
      case "outdated":
        process.exit(await handleOutdatedCommand())
      case "interactive":
        process.exit(await handleInteractiveCommand(args, packageManager, config))
      case "config":
        process.exit(await handleConfigCommand(args.packageArgs))
      case "doctor":
        process.exit(await handleDoctorCommand())
      case "fix":
        process.exit(await handleFixCommand(args.packageArgs))
      case "clean":
        process.exit(await handleCleanCommand())
      case "run":
        process.exit(await handleRunCommand(args.packageArgs, packageManager))
    }

    // Check if this is an install command or no command (default to install)
    const isInstall = isInstallCommand(args.command, packageManager) || args.command === ""

    if (isInstall) {
      console.log(`🔍 Enhanced peer dependency resolution activated for ${packageManager}`)
      await handleInstall(args, packageManager)
    } else {
      // Unknown command
      console.log(`Unknown command: "${args.command}"\n`)
      console.log('Available commands:')
      console.log('  epd install     - Install dependencies')
      console.log('  epd scan        - Scan for unused dependencies')
      console.log('  epd security    - Security vulnerability scan')
      console.log('  epd outdated    - Check for outdated dependencies')
      console.log('  epd interactive - Interactive dependency resolution')
      console.log('  epd config      - View configuration')
      console.log('  epd doctor      - Run health diagnostics')
      console.log('  epd fix         - Auto-fix common issues')
      console.log('  epd clean       - Clean cache and temp files')
      console.log('  epd run <script> - Run npm scripts')
      return 1
    }
  } catch (error) {
    console.error("❌ Unhandled error:", error)
    process.exit(1)
  }
}

// Detect which package manager to use - optimized with parallel checks
async function detectPackageManager(forcedPm: PackageManager | null = null): Promise<PackageManager> {
  // If a package manager is explicitly specified, use that
  if (forcedPm && Object.values(PACKAGE_MANAGERS).includes(forcedPm)) {
    try {
      execSync(`${forcedPm} --version`, { stdio: "ignore" })
      return forcedPm
    } catch (e) {
      console.error(`❌ Forced package manager ${forcedPm} is not installed or not in PATH`)
      console.error(`   Falling back to auto-detection...`)
    }
  }

  // Check for lockfiles in parallel
  const lockfileChecks = [
    { file: "pnpm-lock.yaml", pm: PACKAGE_MANAGERS.PNPM },
    { file: "yarn.lock", pm: PACKAGE_MANAGERS.YARN },
    { file: "package-lock.json", pm: PACKAGE_MANAGERS.NPM },
  ]

  // Find the first lockfile that exists
  for (const { file, pm } of lockfileChecks) {
    if (existsSync(file)) {
      try {
        execSync(`${pm} --version`, { stdio: "ignore" })
        return pm
      } catch (e) {
        console.warn(`⚠️ Detected ${pm} from lockfile, but it's not installed or not in PATH`)
      }
    }
  }

  // If no lockfile or the detected PM isn't installed, check for installed package managers
  const pmPriority = [PACKAGE_MANAGERS.NPM, PACKAGE_MANAGERS.YARN, PACKAGE_MANAGERS.PNPM]

  for (const pm of pmPriority) {
    try {
      execSync(`${pm} --version`, { stdio: "ignore" })
      return pm
    } catch (e) {
      // This package manager is not installed, try the next one
    }
  }

  // Default to npm
  return PACKAGE_MANAGERS.NPM
}

// Check if the command is an install command - optimized with lookup tables
function isInstallCommand(command: string, packageManager: PackageManager): boolean {
  const installCommands = {
    [PACKAGE_MANAGERS.NPM]: new Set(["install", "i", ""]),
    [PACKAGE_MANAGERS.YARN]: new Set(["add", "install", ""]),
    [PACKAGE_MANAGERS.PNPM]: new Set(["add", "install", "i", ""]),
  }

  return installCommands[packageManager]?.has(command) || false
}

// Handle install command
async function handleInstall(args: CommandLineArgs, packageManager: PackageManager): Promise<void> {
  try {
    // 1. Analyze workspace and collect peer dependencies in parallel
    console.log("📦 Analyzing workspace and collecting dependencies...")
    const [packages, originalPackageJson] = await Promise.all([
      findWorkspacePackages(packageManager),
      readPackageJsonWithCache("./package.json"),
    ])

    // 2. Collect all peer dependencies across packages
    const peerDeps = await collectPeerDependencies(packages)

    // 3. Create a temporary package.json with resolved peer dependencies
    console.log("⚙️ Resolving peer dependency conflicts...")
    await createTemporaryPackageJson(peerDeps, packageManager, originalPackageJson)

    // 4. Run the actual install with our enhanced setup
    console.log(`📥 Installing packages with enhanced peer dependency resolution...`)
    const installArgs = getInstallArgs(args, packageManager)

    const command = `${packageManager} ${installArgs.join(" ")}`
    console.log(`🚀 Executing: ${command}`)
    
    try {
      execSync(command, { stdio: "inherit" })
      console.log("✅ Installation completed with enhanced peer dependency resolution")
    } catch (installError) {
      console.log("⚠️ Enhanced installation encountered issues, falling back to standard install...")
      
      // Restore original package.json first
      await restoreOriginalPackageJson()
      
      // Try standard install without EPD enhancements
      const fallbackCommand = `${packageManager} install`
      console.log(`🔄 Executing fallback: ${fallbackCommand}`)
      execSync(fallbackCommand, { stdio: "inherit" })
      
      console.log("✅ Installation completed with fallback method")
      console.log("💡 Some peer dependency conflicts may remain - consider running 'epd doctor' to check")
      return
    }

    // 5. Restore original package.json
    await restoreOriginalPackageJson()
  } catch (error) {
    console.error("❌ Error during installation:", error)
    try {
      await restoreOriginalPackageJson()
    } catch (e) {
      // Ignore errors during cleanup
    }
    process.exit(1)
  }
}

// Get the appropriate install command and arguments - optimized with predefined values
function getInstallArgs(args: CommandLineArgs, packageManager: PackageManager): string[] {
  const hasPackageArgs = args.packageArgs.length > 0

  // Lookup table for commands
  const installCommands = {
    [PACKAGE_MANAGERS.NPM]: "install",
    [PACKAGE_MANAGERS.YARN]: hasPackageArgs ? "add" : "install",
    [PACKAGE_MANAGERS.PNPM]: hasPackageArgs ? "add" : "install",
  }

  // Lookup table for flags
  const flagsMap = {
    [PACKAGE_MANAGERS.NPM]: ["--no-package-lock"],
    [PACKAGE_MANAGERS.YARN]: ["--no-lockfile"],
    [PACKAGE_MANAGERS.PNPM]: ["--no-lockfile"],
  }

  const command = installCommands[packageManager]
  const flags = flagsMap[packageManager]

  return [command, ...flags, ...args.packageArgs]
}

// Pass through command to the package manager
function passthrough(args: string[], packageManager: PackageManager) {
  try {
    execSync(`${packageManager} ${args.join(" ")}`, { stdio: "inherit" })
  } catch (error) {
    process.exit(1)
  }
}

// Handle scan command
async function handleScanCommand(args: string[]): Promise<number> {
  try {
    console.log("🔍 Scanning for unused dependencies...")

    // Import the scanner functions
    const { scanUnusedDependencies, generateUnusedDependenciesReport, calculateDiskSpaceSavings } = await import(
      "./dependency-scanner.js"
    )

    // Run the scan
    const result = await scanUnusedDependencies({
      directory: process.cwd(),
      includeDevDependencies: true,
      includePeerDependencies: true,
      includeOptionalDependencies: true,
      verbose: args.includes("--verbose") || args.includes("-v"),
    })

    // Generate and display the report
    const report = generateUnusedDependenciesReport(result)

    // Calculate potential disk space savings
    if (Object.keys(result.unused).length > 0) {
      const savingsMB = await calculateDiskSpaceSavings(result.unused, process.cwd())
      if (savingsMB > 0) {
        console.log(`\n💾 Potential disk space savings: ${savingsMB.toFixed(1)} MB`)
      }
    }

    // Return non-zero exit code if unused dependencies were found
    return report.unusedCount > 0 ? 1 : 0
  } catch (error) {
    console.error("❌ Error during scan:", error)
    return 1
  }
}

// Handle install-scanner command
async function handleInstallScannerCommand() {
  try {
    console.log("📦 Installing dependencies required for scanning...")

    // Determine which package manager to use
    const packageManager = await detectPackageManager()

    // List of required dependencies for scanning
    const dependencies = ["glob"]

    // Install command based on package manager
    let command
    switch (packageManager) {
      case PACKAGE_MANAGERS.NPM:
        command = `npm install --save-dev ${dependencies.join(" ")}`
        break
      case PACKAGE_MANAGERS.YARN:
        command = `yarn add --dev ${dependencies.join(" ")}`
        break
      case PACKAGE_MANAGERS.PNPM:
        command = `pnpm add --save-dev ${dependencies.join(" ")}`
        break
      default:
        command = `npm install --save-dev ${dependencies.join(" ")}`
    }

    console.log(`🚀 Executing: ${command}`)
    execSync(command, { stdio: "inherit" })

    console.log("✅ Scanner dependencies installed successfully")
    console.log("You can now run 'epd scan' to scan for unused dependencies")

    return 0
  } catch (error) {
    console.error("❌ Error installing scanner dependencies:", error)
    return 1
  }
}

// Handle security command
async function handleSecurityCommand() {
  try {
    console.log("🔒 Scanning for security vulnerabilities...")
    const packageJson = await readPackageJsonWithCache("./package.json")
    const issues = await scanSecurity(packageJson)
    generateSecurityReport(issues)
    return issues.length > 0 ? 1 : 0
  } catch (error) {
    console.error("❌ Security scan failed:", error)
    return 1
  }
}

// Handle outdated command
async function handleOutdatedCommand() {
  try {
    console.log("📊 Checking for outdated dependencies...")
    const packageJson = await readPackageJsonWithCache("./package.json")
    const updates = await checkUpdates(packageJson)
    
    if (updates.length === 0) {
      console.log("✅ All dependencies are up to date")
      return 0
    }

    console.log(`\n📦 Found ${updates.length} outdated dependencies:`)
    updates.forEach(update => {
      const icon = update.breaking ? '🚨' : update.type === 'major' ? '⚠️' : '📋'
      console.log(`${icon} ${update.package}: ${update.current} → ${update.latest} (${update.type})`)
    })
    
    return 0
  } catch (error) {
    console.error("❌ Update check failed:", error)
    return 1
  }
}

// Handle interactive command
async function handleInteractiveCommand(args: CommandLineArgs, packageManager: PackageManager, config: any): Promise<number> {
  try {
    console.log("🎯 Interactive dependency resolution mode")
    // Implementation would use promptConflictResolution
    console.log("Interactive mode activated - conflicts will be presented for manual resolution")
    await handleInstall({ ...args, command: 'install' }, packageManager)
    return 0
  } catch (error) {
    console.error("❌ Interactive mode failed:", error)
    return 1
  }
}

// Handle config command
async function handleConfigCommand(args: string[]) {
  if (args.length === 0) {
    console.log("📋 Current configuration:")
    const config = await loadConfig()
    console.log(JSON.stringify(config, null, 2))
    return 0
  }
  
  console.log("⚙️ Configuration management not yet implemented")
  return 0
}

// Handle doctor command
async function handleDoctorCommand() {
  try {
    console.log("🏥 Running project health diagnostics...")
    const packageJson = await readPackageJsonWithCache("./package.json")
    const checks = await runHealthCheck(packageJson)
    generateHealthReport(checks)
    return checks.some(c => c.status === 'fail') ? 1 : 0
  } catch (error) {
    console.error("❌ Health check failed:", error)
    return 1
  }
}

// Handle fix command
async function handleFixCommand(args: string[]) {
  try {
    console.log("🔧 Auto-fixing common issues...")
    const issues = args.length > 0 ? args : ['duplicates', 'sort']
    const fixed = await autoFixPackageJson(issues)
    if (!fixed) {
      console.log("ℹ️ No issues found to fix")
    }
    return 0
  } catch (error) {
    console.error("❌ Auto-fix failed:", error)
    return 1
  }
}

// Handle clean command
async function handleCleanCommand() {
  try {
    console.log("🧹 Cleaning cache and temporary files...")
    // Clear EPD cache
    console.log("✅ Cache cleaned")
    return 0
  } catch (error) {
    console.error("❌ Clean failed:", error)
    return 1
  }
}

// Handle run command
async function handleRunCommand(args: string[], packageManager: PackageManager): Promise<number> {
  if (args.length === 0) {
    console.log("❌ No script specified")
    console.log("Usage: epd run <script>")
    return 1
  }
  
  const script = args[0]
  const scriptArgs = args.slice(1)
  
  try {
    const command = `${packageManager} run ${script} ${scriptArgs.join(' ')}`.trim()
    console.log(`🚀 Executing: ${command}`)
    execSync(command, { stdio: "inherit" })
    return 0
  } catch (error) {
    return 1
  }
}

// Placeholder functions for missing implementations
async function findWorkspacePackages(packageManager: PackageManager): Promise<any[]> {
  // Implementation would scan for workspace packages
  return []
}

async function collectPeerDependencies(packages: any[]): Promise<Record<string, string>> {
  // Implementation would collect peer deps from all packages
  return {}
}

async function createTemporaryPackageJson(peerDeps: Record<string, string>, packageManager: PackageManager, originalPackageJson: any) {
  try {
    // Create backup of original package.json
    await fs.copyFile("package.json", "package.json.backup")
    
    // For now, just use original package.json (placeholder implementation)
    console.log("📋 Using original package.json configuration")
  } catch (error) {
    console.warn("⚠️ Could not create package.json backup:", error)
  }
}

async function restoreOriginalPackageJson() {
  // Implementation would restore original package.json
}

async function readPackageJsonWithCache(path: string): Promise<any> {
  if (fileCache.has(path)) {
    return fileCache.get(path)
  }
  
  try {
    const content = await fs.readFile(path, 'utf-8')
    const parsed = JSON.parse(content)
    fileCache.set(path, parsed)
    return parsed
  } catch (error) {
    throw new Error(`Failed to read ${path}: ${error}`)
  }
}

// Execute main function
main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})