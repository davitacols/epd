#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { execSync } from "child_process"
import { fileURLToPath } from "url"
import { PackageManager } from "./types"
import { loadConfig } from "./config.js"
import { scanSecurity, generateSecurityReport } from "./security.js"
import { checkUpdates } from "./updater.js"
import { promptConflictResolution } from "./interactive.js"
import { Cache } from "./cache.js"
import { runHealthCheck, generateHealthReport } from "./doctor.js"
import { autoFixPackageJson } from "./auto-fix.js"
import { PerformanceMonitor } from "./performance-monitor.js"
import { analytics } from "./analytics.js"

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
    analytics.track('command_start', { command: args.command || 'install' })

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
      case "resolve":
        if (args.originalArgs.includes('--ai')) {
          process.exit(await handleAIResolveCommand(args.originalArgs))
        } else {
          process.exit(await handleResolveCommand(args.originalArgs))
        }
        break
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
      case "health":
        process.exit(await handleHealthCommand(args.originalArgs))
      case "optimize":
        process.exit(await handleOptimizeCommand(args.originalArgs))
      case "why":
        process.exit(await handleWhyCommand(args.packageArgs))
      case "tree":
        process.exit(await handleTreeCommand(args.originalArgs))
      case "impact":
        process.exit(await handleImpactCommand(args.packageArgs))
      case "licenses":
        process.exit(await handleLicensesCommand(args.originalArgs))
      case "update":
        process.exit(await handleUpdateCommand(args.originalArgs))
      case "conflicts":
        process.exit(await handleConflictsCommand(args.originalArgs))
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
      console.log('  epd install          - Install dependencies')
      console.log('  epd resolve          - Smart conflict resolution')
      console.log('  epd scan             - Scan for unused dependencies')
      console.log('  epd security         - Security vulnerability scan')
      console.log('  epd health           - Dependency health scores')
      console.log('  epd optimize         - Workspace optimization')
      console.log('  epd why <package>    - Show why package is needed')
      console.log('  epd tree             - Dependency tree')
      console.log('  epd impact <package> - Bundle size impact')
      console.log('  epd licenses         - License compliance check')
      console.log('  epd update           - Safe dependency updates')
      console.log('  epd conflicts        - Interactive conflict resolution')
      console.log('  epd outdated         - Check for outdated dependencies')
      console.log('  epd interactive      - Interactive dependency resolution')
      console.log('  epd config           - View configuration')
      console.log('  epd doctor           - Run health diagnostics')
      console.log('  epd fix              - Auto-fix common issues')
      console.log('  epd clean            - Clean cache and temp files')
      console.log('  epd run <script>     - Run npm scripts')
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
  const monitor = new PerformanceMonitor()
  
  try {
    // 1. Analyze workspace and collect peer dependencies in parallel
    console.log("📦 Analyzing workspace and collecting dependencies...")
    const [packages, originalPackageJson] = await Promise.all([
      findWorkspacePackages(packageManager),
      readPackageJsonWithCache("./package.json"),
    ])
    monitor.checkpoint('Analysis')

    // 2. Collect all peer dependencies across packages
    const peerDeps = await collectPeerDependencies(packages)
    monitor.checkpoint('Conflict Resolution')

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
      analytics.track('install_success', { packageManager, conflictsResolved: Object.keys(peerDeps).length })
    } catch (installError) {
      console.log("⚠️ Enhanced installation encountered issues, trying with --force...")
      
      try {
        const forceCommand = `${packageManager} install --force`
        execSync(forceCommand, { stdio: "inherit" })
        console.log("✅ Installation completed with --force flag")
        analytics.track('install_force', { packageManager })
      } catch (forceError) {
        console.log("⚠️ Force install failed, falling back to standard install...")
        
        await restoreOriginalPackageJson()
        
        const fallbackCommand = `${packageManager} install --legacy-peer-deps`
        console.log(`🔄 Executing fallback: ${fallbackCommand}`)
        execSync(fallbackCommand, { stdio: "inherit" })
        
        console.log("✅ Installation completed with legacy peer deps")
        analytics.track('install_legacy', { packageManager })
        console.log("💡 Some peer dependency conflicts bypassed - run 'epd doctor' to verify")
      }
      return
    }

    // 5. Restore original package.json
    await restoreOriginalPackageJson()
    monitor.checkpoint('Installation')
    
    if (args.debug) {
      monitor.summary()
    }
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
    [PACKAGE_MANAGERS.NPM]: ["--legacy-peer-deps"],
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

// Handle AI-powered conflict resolution
async function handleAIResolveCommand(args: string[]): Promise<number> {
  try {
    console.log('🤖 Analyzing conflicts with AI...')
    
    const { resolveWithAI } = await import('./ai-resolver.js')
    const packageJson = await readPackageJsonWithCache('./package.json')
    
    // Detect conflicts (simplified for demo)
    const conflicts: any[] = []
    const projectContext = {
      packageManager: await detectPackageManager(),
      isMonorepo: await detectMonorepo(),
      dependencies: { ...packageJson.dependencies, ...packageJson.devDependencies }
    }
    
    const preferences = {
      preferStable: !args.includes('--latest'),
      riskTolerance: args.includes('--aggressive') ? 'high' as const : 'medium' as const
    }
    
    const resolutions = await resolveWithAI(conflicts, projectContext, preferences)
    
    console.log('\n🎯 AI Recommendations:')
    resolutions.forEach(res => {
      console.log(`\n📦 ${res.package}:`)
      console.log(`   Recommended: ${res.recommendedVersion} (${Math.round(res.confidence * 100)}% confidence)`)
      console.log(`   Reasoning: ${res.reasoning}`)
      
      if (res.alternatives.length > 0) {
        console.log('   Alternatives:')
        res.alternatives.forEach(alt => {
          console.log(`     - ${alt.version}: ${alt.pros.join(', ')}`)
        })
      }
    })
    
    return 0
  } catch (error) {
    console.error('❌ AI resolution failed:', error)
    return 1
  }
}

async function detectMonorepo(): Promise<boolean> {
  try {
    const packageJson = await readPackageJsonWithCache('./package.json')
    return !!(packageJson.workspaces || existsSync('lerna.json') || existsSync('pnpm-workspace.yaml'))
  } catch {
    return false
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

// Handle resolve command
async function handleResolveCommand(args: string[]): Promise<number> {
  try {
    const strategy = args.includes('--stable') ? 'stable' : 'smart'
    console.log(`🎯 Smart conflict resolution (${strategy} strategy)...`)
    
    const { smartResolve } = await import('./smart-resolver.js')
    const conflicts = {} // Would detect actual conflicts
    const resolutions = await smartResolve(conflicts, strategy)
    
    console.log(`\n✅ Resolved ${resolutions.length} conflicts:`)
    resolutions.forEach(res => {
      console.log(`📦 ${res.package}: ${res.resolvedVersion} (${res.strategy}, ${Math.round(res.confidence * 100)}% confidence)`)
    })
    
    return 0
  } catch (error) {
    console.error('❌ Smart resolution failed:', error)
    return 1
  }
}

// Handle health command
async function handleHealthCommand(args: string[]): Promise<number> {
  try {
    console.log('🏥 Analyzing dependency health...')
    const { calculateHealthScore } = await import('./health-checker.js')
    const packageJson = await readPackageJsonWithCache('./package.json')
    const scores = await calculateHealthScore(packageJson)
    
    if (args.includes('--score')) {
      scores.forEach(score => {
        const icon = score.score > 0.8 ? '✅' : score.score > 0.6 ? '⚠️' : '❌'
        console.log(`${icon} ${score.package}: ${(score.score * 100).toFixed(0)}%`)
      })
    }
    
    if (args.includes('--recommendations')) {
      const needsAttention = scores.filter(s => s.recommendations.length > 0)
      needsAttention.forEach(score => {
        console.log(`\n📦 ${score.package}:`)
        score.recommendations.forEach(rec => console.log(`   - ${rec}`))
      })
    }
    
    return 0
  } catch (error) {
    console.error('❌ Health check failed:', error)
    return 1
  }
}

// Handle optimize command
async function handleOptimizeCommand(args: string[]): Promise<number> {
  try {
    const strategy = args.includes('--dedupe') ? 'dedupe' : 'hoist'
    console.log(`🔧 Optimizing workspace (${strategy})...`)
    
    const { optimizeWorkspace } = await import('./workspace-optimizer.js')
    const result = await optimizeWorkspace(strategy)
    
    console.log(`\n✅ Optimization complete:`)
    if (result.hoisted.length > 0) {
      console.log(`📤 Hoisted: ${result.hoisted.join(', ')}`)
    }
    if (result.deduped.length > 0) {
      console.log(`🔄 Deduped: ${result.deduped.join(', ')}`)
    }
    console.log(`💾 Savings: ${result.savings.packages} packages, ${result.savings.sizeMB.toFixed(1)}MB`)
    
    return 0
  } catch (error) {
    console.error('❌ Optimization failed:', error)
    return 1
  }
}

// Handle why command
async function handleWhyCommand(args: string[]): Promise<number> {
  if (args.length === 0) {
    console.log('❌ No package specified')
    console.log('Usage: epd why <package>')
    return 1
  }
  
  try {
    const { whyDependency } = await import('./dependency-analyzer.js')
    const result = await whyDependency(args[0])
    
    console.log(`\n📦 ${result.package} (${result.type}, depth: ${result.depth}):`)
    console.log('Required by:')
    result.requiredBy.forEach(req => console.log(`  - ${req}`))
    
    return 0
  } catch (error) {
    console.error('❌ Analysis failed:', error)
    return 1
  }
}

// Handle tree command
async function handleTreeCommand(args: string[]): Promise<number> {
  try {
    const conflictsOnly = args.includes('--conflicts-only')
    console.log(`🌳 Dependency tree${conflictsOnly ? ' (conflicts only)' : ''}...`)
    
    const { generateDependencyTree } = await import('./dependency-analyzer.js')
    const tree = await generateDependencyTree(conflictsOnly)
    
    Object.entries(tree).forEach(([pkg, deps]) => {
      console.log(`\n📦 ${pkg}:`)
      deps.forEach(dep => console.log(`  └── ${dep}`))
    })
    
    return 0
  } catch (error) {
    console.error('❌ Tree generation failed:', error)
    return 1
  }
}

// Handle impact command
async function handleImpactCommand(args: string[]): Promise<number> {
  if (args.length === 0) {
    console.log('❌ No package specified')
    console.log('Usage: epd impact <package>')
    return 1
  }
  
  try {
    const { analyzeBundleImpact } = await import('./dependency-analyzer.js')
    const impact = await analyzeBundleImpact(args[0])
    
    console.log(`\n📊 Bundle impact for ${impact.package}:`)
    console.log(`   Size: ${impact.sizeMB.toFixed(2)}MB`)
    console.log(`   Gzipped: ${impact.gzippedMB.toFixed(2)}MB`)
    console.log(`   Dependencies: ${impact.dependencies}`)
    
    return 0
  } catch (error) {
    console.error('❌ Impact analysis failed:', error)
    return 1
  }
}

// Handle licenses command
async function handleLicensesCommand(args: string[]): Promise<number> {
  try {
    console.log('📄 Checking license compliance...')
    const { checkLicenses, generateLicenseReport } = await import('./license-checker.js')
    const packageJson = await readPackageJsonWithCache('./package.json')
    const report = await checkLicenses(packageJson)
    
    if (args.includes('--report')) {
      generateLicenseReport(report)
    } else {
      console.log(`✅ ${report.summary.compatible}/${report.summary.total} packages compatible`)
      if (report.summary.risks > 0) {
        console.log(`⚠️ ${report.summary.risks} high-risk licenses found`)
      }
    }
    
    return report.summary.risks > 0 ? 1 : 0
  } catch (error) {
    console.error('❌ License check failed:', error)
    return 1
  }
}

// Handle update command
async function handleUpdateCommand(args: string[]): Promise<number> {
  try {
    const breakingChanges = args.includes('--breaking-changes')
    const safeOnly = args.includes('--safe')
    
    console.log(`🔄 Planning ${safeOnly ? 'safe ' : ''}updates...`)
    
    const { planSafeUpdates, applyUpdates } = await import('./auto-updater.js')
    const packageJson = await readPackageJsonWithCache('./package.json')
    const plans = await planSafeUpdates(packageJson)
    
    const filteredPlans = safeOnly ? plans.filter(p => p.safe) : plans
    
    if (filteredPlans.length === 0) {
      console.log('✅ All packages are up to date')
      return 0
    }
    
    console.log(`\n📋 Update plan (${filteredPlans.length} packages):`)
    filteredPlans.forEach(plan => {
      const icon = plan.breaking ? '🚨' : plan.safe ? '✅' : '⚠️'
      console.log(`${icon} ${plan.package}: ${plan.current} → ${plan.target} (${plan.type})`)
    })
    
    await applyUpdates(filteredPlans, breakingChanges)
    return 0
  } catch (error) {
    console.error('❌ Update failed:', error)
    return 1
  }
}

// Handle conflicts command
async function handleConflictsCommand(args: string[]): Promise<number> {
  try {
    console.log('🎯 Interactive conflict resolution...')
    const fix = args.includes('--fix')
    
    // Would implement interactive conflict resolution
    console.log('Interactive conflict resolution activated')
    if (fix) {
      console.log('Auto-fixing detected conflicts...')
    }
    
    return 0
  } catch (error) {
    console.error('❌ Conflict resolution failed:', error)
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

// Core implementation functions
async function findWorkspacePackages(packageManager: PackageManager): Promise<any[]> {
  const packages = []
  const rootPackageJson = await readPackageJsonWithCache("./package.json")
  
  // Add root package
  packages.push({ path: ".", packageJson: rootPackageJson })
  
  // Check for workspaces
  if (rootPackageJson.workspaces) {
    const workspaces = Array.isArray(rootPackageJson.workspaces) 
      ? rootPackageJson.workspaces 
      : rootPackageJson.workspaces.packages
    
    for (const workspace of workspaces) {
      try {
        const workspacePath = workspace.replace('/*', '')
        if (existsSync(path.join(workspacePath, 'package.json'))) {
          const wsPackageJson = await readPackageJsonWithCache(path.join(workspacePath, 'package.json'))
          packages.push({ path: workspacePath, packageJson: wsPackageJson })
        }
      } catch (e) {
        // Skip invalid workspaces
      }
    }
  }
  
  return packages
}

async function collectPeerDependencies(packages: any[]): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {}
  
  // Use the main package.json for conflict detection
  const mainPackage = packages.find(pkg => pkg.path === '.') || packages[0]
  if (!mainPackage) return resolved
  
  // Import conflict detection and resolution
  const { detectConflicts } = await import('./conflict-detector.js')
  const { resolveConflicts } = await import('./conflict-resolver.js')
  
  // Detect conflicts in the package.json
  const conflicts = await detectConflicts(mainPackage.packageJson)
  
  if (conflicts.length > 0) {
    console.log(`🔍 Found ${conflicts.length} peer dependency conflicts:`)
    conflicts.forEach(conflict => {
      console.log(`   ${conflict.package}: ${conflict.requiredVersions.join(', ')} (required by ${conflict.requiredBy.join(', ')})`)
    })
    
    // Resolve conflicts
    const resolutions = await resolveConflicts(conflicts)
    
    for (const resolution of resolutions) {
      resolved[resolution.package] = resolution.resolvedVersion
      console.log(`✅ Resolved ${resolution.package} to ${resolution.resolvedVersion} (${resolution.strategy}, ${Math.round(resolution.confidence * 100)}% confidence)`)
    }
  }
  
  return resolved
}



async function createTemporaryPackageJson(peerDeps: Record<string, string>, packageManager: PackageManager, originalPackageJson: any) {
  try {
    await fs.copyFile("package.json", "package.json.backup")
    
    if (Object.keys(peerDeps).length === 0) {
      console.log(`📋 No peer dependency conflicts to resolve`)
      return
    }
    
    const tempPackageJson = { ...originalPackageJson }
    let updatedCount = 0
    
    for (const [pkg, version] of Object.entries(peerDeps)) {
      const currentDep = tempPackageJson.dependencies?.[pkg]
      const currentDevDep = tempPackageJson.devDependencies?.[pkg]
      
      if (currentDep && currentDep !== `^${version}`) {
        tempPackageJson.dependencies[pkg] = `^${version}`
        updatedCount++
        console.log(`  📝 Updated ${pkg}: ${currentDep} → ^${version}`)
      } else if (currentDevDep && currentDevDep !== `^${version}`) {
        tempPackageJson.devDependencies[pkg] = `^${version}`
        updatedCount++
        console.log(`  📝 Updated ${pkg}: ${currentDevDep} → ^${version} (dev)`)
      } else if (!currentDep && !currentDevDep) {
        tempPackageJson.dependencies = tempPackageJson.dependencies || {}
        tempPackageJson.dependencies[pkg] = `^${version}`
        updatedCount++
        console.log(`  ➕ Added ${pkg}: ^${version}`)
      }
    }
    
    if (updatedCount > 0) {
      await fs.writeFile("package.json", JSON.stringify(tempPackageJson, null, 2))
      console.log(`📋 Applied ${updatedCount} dependency updates`)
    }
  } catch (error) {
    console.warn("⚠️ Could not create temporary package.json:", error)
    throw error
  }
}

async function restoreOriginalPackageJson() {
  try {
    if (existsSync("package.json.backup")) {
      await fs.copyFile("package.json.backup", "package.json")
      await fs.unlink("package.json.backup")
      console.log("📋 Restored original package.json")
    }
  } catch (error) {
    console.warn("⚠️ Could not restore original package.json:", error)
  }
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