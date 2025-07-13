#!/usr/bin/env node

import fs from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { execSync } from "child_process"
import { fileURLToPath } from "url"
import semver from "semver"

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Cache for npm registry responses to avoid redundant requests
const packageVersionCache = new Map()
// Cache for file reads to avoid redundant I/O
const fileCache = new Map()

// Package manager detection and configuration
const PACKAGE_MANAGERS = {
  NPM: "npm",
  YARN: "yarn",
  PNPM: "pnpm",
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
const KNOWN_PROBLEMATIC_PACKAGES = {
  "react-redux": { react: "*", redux: "*" },
  "@mui/material": { react: "*", "react-dom": "*" },
  "styled-components": { react: "*", "react-dom": "*" },
  vuex: { vue: "*" },
  "vue-router": { vue: "*" },
  "graphql-tag": { graphql: "*" },
}

// Command line argument parsing - optimized with single-pass parsing
function parseArgs(args) {
  const result = {
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
      result.forcedPm = arg.split("=")[1]
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

    // Check if this is a scan command
    if (args.command === "scan") {
      return await handleScanCommand(args.originalArgs)
    } else if (args.command === "install-scanner") {
      return await handleInstallScannerCommand()
    }

    // Check if this is an install command
    const isInstall = isInstallCommand(args.command, packageManager)

    if (isInstall) {
      console.log(`🔍 Enhanced peer dependency resolution activated for ${packageManager}`)
      await handleInstall(args, packageManager)
    } else {
      // For other commands, just pass through to the package manager
      passthrough(args.originalArgs, packageManager)
    }
  } catch (error) {
    console.error("❌ Unhandled error:", error)
    process.exit(1)
  }
}

// Detect which package manager to use - optimized with parallel checks
async function detectPackageManager(forcedPm = null) {
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
function isInstallCommand(command, packageManager) {
  const installCommands = {
    [PACKAGE_MANAGERS.NPM]: new Set(["install", "i", ""]),
    [PACKAGE_MANAGERS.YARN]: new Set(["add", "install", ""]),
    [PACKAGE_MANAGERS.PNPM]: new Set(["add", "install", "i", ""]),
  }

  return installCommands[packageManager]?.has(command) || false
}

// Handle install command
async function handleInstall(args, packageManager) {
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
    execSync(command, { stdio: "inherit" })

    // 5. Restore original package.json
    await restoreOriginalPackageJson()

    console.log("✅ Installation completed with enhanced peer dependency resolution")
  } catch (error) {
    console.error("❌ Error during enhanced installation:", error)
    try {
      await restoreOriginalPackageJson()
    } catch (e) {
      // Ignore errors during cleanup
    }
    process.exit(1)
  }
}

// Get the appropriate install command and arguments - optimized with predefined values
function getInstallArgs(args, packageManager) {
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

// Find all packages in the workspace - optimized with parallel file operations
async function findWorkspacePackages(packageManager) {
  const packages = []

  try {
    // Read the root package.json
    const rootPackageJson = await readPackageJsonWithCache("./package.json")

    // Handle different workspace configurations
    let useWorkspaces = false
    let usePnpmWorkspace = false

    if (rootPackageJson.workspaces) {
      useWorkspaces = true
      console.log(`📂 Detected workspaces configuration in package.json`)
    } else if (packageManager === PACKAGE_MANAGERS.PNPM && existsSync("pnpm-workspace.yaml")) {
      usePnpmWorkspace = true
      console.log("📂 Detected pnpm workspaces configuration")
    } else {
      // Single package repository
      packages.push({
        path: ".",
        name: rootPackageJson.name || "root",
        packageJson: rootPackageJson,
      })
      return packages // Early return for efficiency
    }

    // For workspace projects, scan common directories in parallel
    const commonDirs = ["packages", "apps", "libs", "components", "modules"]

    // Create an array of promises for each directory scan
    const dirPromises = commonDirs.map(async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const packagePromises = entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const packagePath = path.join(dir, entry.name)
            const packageJsonPath = path.join(packagePath, "package.json")

            if (existsSync(packageJsonPath)) {
              try {
                const packageJson = await readPackageJsonWithCache(packageJsonPath)
                return {
                  path: packagePath,
                  name: packageJson.name || entry.name,
                  packageJson,
                }
              } catch (e) {
                return null // Invalid package.json
              }
            }
            return null // No package.json
          })

        // Wait for all package.json files to be processed
        const results = await Promise.all(packagePromises)
        return results.filter(Boolean) // Filter out nulls
      } catch (e) {
        return [] // Directory doesn't exist
      }
    })

    // Wait for all directory scans to complete
    const dirResults = await Promise.all(dirPromises)

    // Flatten the results and add to packages
    for (const result of dirResults) {
      packages.push(...result)
    }

    // Also add the root package
    packages.push({
      path: ".",
      name: rootPackageJson.name || "root",
      packageJson: rootPackageJson,
    })
  } catch (e) {
    console.warn("⚠️ Could not parse package.json, assuming single package")
    packages.push({
      path: ".",
      name: "unknown",
      packageJson: {},
    })
  }

  console.log(`📊 Found ${packages.length} packages in the workspace`)
  return packages
}

// Helper to read package.json with caching for better performance
async function readPackageJsonWithCache(filePath) {
  if (fileCache.has(filePath)) {
    return fileCache.get(filePath)
  }

  try {
    const content = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(content)
    fileCache.set(filePath, parsed)
    return parsed
  } catch (e) {
    throw new Error(`Failed to read ${filePath}: ${e.message}`)
  }
}

// Collect all peer dependencies from all packages - optimized with efficient data structures
async function collectPeerDependencies(packages) {
  // Use a Map for faster lookups
  const allPeerDeps = new Map()

  // Collect all peer dependencies from all packages
  for (const pkg of packages) {
    const { packageJson } = pkg

    if (packageJson.peerDependencies) {
      for (const [dep, versionRange] of Object.entries(packageJson.peerDependencies)) {
        if (!allPeerDeps.has(dep)) {
          allPeerDeps.set(dep, [])
        }

        // Store the package that requires this peer dependency and the version it needs
        allPeerDeps.get(dep).push({
          requiredBy: pkg.name,
          versionRange,
        })
      }
    }
  }

  // Resolve version conflicts - optimize by handling simple cases quickly
  const resolvedPeerDeps = {}
  const conflictReport = {}

  // Process each dependency - use parallelization for version resolution
  const resolutionPromises = []

  for (const [dep, requirements] of allPeerDeps.entries()) {
    // Fast path: If only one requirement, no conflict to resolve
    if (requirements.length === 1) {
      resolvedPeerDeps[dep] = requirements[0].versionRange
      continue
    }

    // We have multiple requirements, need to resolve potential conflicts
    resolutionPromises.push(
      resolveVersionConflict(dep, requirements).then((resolution) => {
        resolvedPeerDeps[dep] = resolution.resolvedVersion

        // Store conflict information for reporting
        if (resolution.hasConflict) {
          conflictReport[dep] = {
            requirements,
            resolvedVersion: resolution.resolvedVersion,
            resolution: resolution.resolutionType,
            availableVersionsCount: resolution.availableVersionsCount,
          }
        }
      }),
    )
  }

  // Wait for all version resolutions to complete
  if (resolutionPromises.length > 0) {
    await Promise.all(resolutionPromises)
  }

  // Report conflicts
  reportConflicts(conflictReport)

  return resolvedPeerDeps
}

// Resolve version conflicts using semver - optimized with caching and early returns
async function resolveVersionConflict(packageName, requirements) {
  // Extract all version ranges
  const ranges = requirements.map((req) => req.versionRange)

  // Fast path: Try to find simple intersection without API calls
  let intersection = ranges[0]
  let hasValidIntersection = true

  for (let i = 1; i < ranges.length; i++) {
    try {
      intersection = semver.validRange(`${intersection} ${ranges[i]}`)
      if (!intersection) {
        hasValidIntersection = false
        break
      }
    } catch (e) {
      hasValidIntersection = false
      break
    }
  }

  // If we found a valid intersection that's exact, return it immediately
  if (hasValidIntersection && semver.valid(intersection)) {
    return {
      resolvedVersion: intersection,
      hasConflict: false,
      resolutionType: "exact-match",
      availableVersionsCount: 0,
    }
  }

  console.log(`\n📊 Resolving version conflict for ${packageName}`)

  // Step 1: Check if there's a version that satisfies all requirements
  if (hasValidIntersection) {
    try {
      const resolvedVersion = await findVersionIntersection(packageName, ranges)
      if (resolvedVersion) {
        return {
          resolvedVersion,
          hasConflict: false,
          resolutionType: "intersection",
          availableVersionsCount: 0,
        }
      }
    } catch (e) {
      console.log(`  ⚠️ Could not find version intersection: ${e.message}`)
    }
  }

  // Step 2: If no intersection, find the best compromise version
  console.log(`  ⚠️ No single version satisfies all requirements for ${packageName}`)
  console.log(`  🔍 Finding best compromise version...`)

  // Get available versions for this package (cached)
  let availableVersions
  try {
    availableVersions = await getPackageVersionsFromRegistry(packageName)
    console.log(`  📋 Found ${availableVersions.length} available versions`)
  } catch (e) {
    console.log(`  ⚠️ Could not fetch versions: ${e.message}`)
    // Fallback to highest required version
    const highestVersion = findHighestSemverVersion(ranges)
    return {
      resolvedVersion: highestVersion,
      hasConflict: true,
      resolutionType: "highest-required-fallback",
      availableVersionsCount: 0,
    }
  }

  // Empty array check
  if (!availableVersions.length) {
    const highestVersion = findHighestSemverVersion(ranges)
    return {
      resolvedVersion: highestVersion,
      hasConflict: true,
      resolutionType: "no-versions-fallback",
      availableVersionsCount: 0,
    }
  }

  // Score each available version by how many requirements it satisfies
  // Use pre-calculated requirement objects for performance
  const reqObjects = ranges.map((range) => {
    try {
      return range === "*" ? null : new semver.Range(range)
    } catch (e) {
      return null
    }
  })

  let bestMatch = { version: availableVersions[0], satisfiedCount: 0, percentage: 0 }

  for (const version of availableVersions) {
    let satisfiedCount = 0

    for (let i = 0; i < reqObjects.length; i++) {
      const reqObj = reqObjects[i]
      const range = ranges[i]

      if (range === "*" || !reqObj) {
        satisfiedCount++
      } else {
        try {
          if (semver.satisfies(version, reqObj)) {
            satisfiedCount++
          }
        } catch (e) {
          // Invalid comparison, skip
        }
      }
    }

    const percentage = (satisfiedCount / requirements.length) * 100

    // Update best match if this version satisfies more requirements or same number but higher version
    if (
      satisfiedCount > bestMatch.satisfiedCount ||
      (satisfiedCount === bestMatch.satisfiedCount && semver.gt(version, bestMatch.version))
    ) {
      bestMatch = { version, satisfiedCount, percentage }
    }

    // Early exit if we find a version that satisfies all requirements
    if (satisfiedCount === requirements.length) {
      break
    }
  }

  if (bestMatch.satisfiedCount > 0) {
    console.log(
      `  ✅ Best compromise: ${bestMatch.version} (satisfies ${bestMatch.satisfiedCount}/${requirements.length} requirements, ${bestMatch.percentage.toFixed(1)}%)`,
    )

    return {
      resolvedVersion: bestMatch.version,
      hasConflict: true,
      resolutionType: "best-compromise",
      availableVersionsCount: availableVersions.length,
    }
  }

  // If we couldn't find a compromise, use the highest required version
  const highestVersion = findHighestSemverVersion(ranges)
  console.log(`  ⚠️ No compromise found. Using highest required version: ${highestVersion}`)

  return {
    resolvedVersion: highestVersion,
    hasConflict: true,
    resolutionType: "highest-required",
    availableVersionsCount: availableVersions.length,
  }
}

// Find a version that satisfies all requirements - optimized with caching
async function findVersionIntersection(packageName, ranges) {
  // Process ranges to handle wildcards consistently
  const processedRanges = ranges.map((range) => (range === "*" ? ">=0.0.0" : range))

  // Combine all ranges into one
  const combinedRange = processedRanges.join(" ")

  // Check if it's a valid range
  const intersection = semver.validRange(combinedRange)
  if (!intersection) return null

  // Get available versions from registry (cached)
  const availableVersions = await getPackageVersionsFromRegistry(packageName)

  // Find the max satisfying version
  const maxSatisfying = semver.maxSatisfying(availableVersions, intersection)
  return maxSatisfying || intersection
}

// Find the highest version from a list of ranges - optimized algorithm
function findHighestSemverVersion(ranges) {
  // Fast path: look for exact versions first
  const exactVersions = []

  for (const range of ranges) {
    if (semver.valid(range)) {
      exactVersions.push(range)
    }
  }

  if (exactVersions.length > 0) {
    return exactVersions.reduce((highest, current) => {
      try {
        return semver.gt(current, highest) ? current : highest
      } catch (e) {
        return highest
      }
    }, exactVersions[0])
  }

  // No exact versions, handle ranges
  // Sort ranges by their potential upper bound, preferring more specific ranges
  const sortedRanges = [...ranges].sort((a, b) => {
    // Wildcards have lowest priority
    if (a === "*") return 1
    if (b === "*") return -1

    // Prioritize caret ranges over tilde ranges
    const aIsCaret = a.startsWith("^")
    const bIsCaret = b.startsWith("^")
    if (aIsCaret && !bIsCaret) return -1
    if (!aIsCaret && bIsCaret) return 1

    // Extract the base version for comparison
    const aBase = a.replace(/[^0-9.]/g, "")
    const bBase = b.replace(/[^0-9.]/g, "")

    try {
      return semver.compare(bBase, aBase) // Higher versions first
    } catch (e) {
      return 0
    }
  })

  return sortedRanges[0]
}

// Get all available versions for a package from npm registry - optimized with caching
async function getPackageVersionsFromRegistry(packageName) {
  // Check cache first for significant performance boost
  if (packageVersionCache.has(packageName)) {
    return packageVersionCache.get(packageName)
  }

  console.log(`  🌐 Fetching versions for ${packageName}...`)

  try {
    // Get registry URL once and cache it
    const registryUrl = getRegistryUrl()

    // Construct the package URL
    const packageUrl = `${registryUrl}${packageName}`

    // Fetch package metadata from registry
    const response = await fetch(packageUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "enhanced-peer-deps/1.0.0",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()

    // Extract and sort versions
    const versions = Object.keys(data.versions || {}).sort((a, b) => semver.compare(b, a))

    // Cache the result
    packageVersionCache.set(packageName, versions)

    return versions
  } catch (error) {
    console.error(`  ❌ Error fetching versions: ${error.message}`)
    return []
  }
}

// Cache for registry URL
let cachedRegistryUrl

// Get npm registry URL - cached for performance
function getRegistryUrl() {
  if (cachedRegistryUrl) return cachedRegistryUrl

  try {
    cachedRegistryUrl = execSync("npm config get registry", { encoding: "utf8" }).trim()
  } catch (e) {
    cachedRegistryUrl = "https://registry.npmjs.org/"
  }

  // Ensure the registry URL ends with a slash
  if (!cachedRegistryUrl.endsWith("/")) {
    cachedRegistryUrl += "/"
  }

  return cachedRegistryUrl
}

// Report conflicts to the console - optimized for readability
function reportConflicts(conflictReport) {
  const conflictCount = Object.keys(conflictReport).length

  if (conflictCount === 0) {
    console.log("✅ No peer dependency conflicts detected")
    return
  }

  console.log(`\n⚠️ Detected ${conflictCount} peer dependency conflicts:`)

  for (const [dep, conflict] of Object.entries(conflictReport)) {
    console.log(`\n📦 ${dep}:`)

    // Show all requirements (grouped by version for cleaner output)
    console.log("  Required by:")
    const versionGroups = new Map()

    for (const req of conflict.requirements) {
      if (!versionGroups.has(req.versionRange)) {
        versionGroups.set(req.versionRange, [])
      }
      versionGroups.get(req.versionRange).push(req.requiredBy)
    }

    for (const [version, packages] of versionGroups.entries()) {
      if (packages.length === 1) {
        console.log(`    - ${packages[0]} requires ${dep}@${version}`)
      } else {
        console.log(`    - ${packages.length} packages require ${dep}@${version}:`)
        console.log(
          `      ${packages.slice(0, 3).join(", ")}${packages.length > 3 ? ` and ${packages.length - 3} more` : ""}`,
        )
      }
    }

    // Show resolution
    console.log(`  → Resolved to: ${conflict.resolvedVersion} (${conflict.resolution})`)

    // Show compatibility summary - group by compatibility status
    const compatible = []
    const incompatible = []

    for (const req of conflict.requirements) {
      try {
        const isCompatible = semver.satisfies(conflict.resolvedVersion, req.versionRange)
        if (isCompatible) {
          compatible.push(req.requiredBy)
        } else {
          incompatible.push(req.requiredBy)
        }
      } catch (e) {
        incompatible.push(req.requiredBy)
      }
    }

    const totalPackages = compatible.length + incompatible.length
    const compatPercent = Math.round((compatible.length / totalPackages) * 100)

    console.log(`  Compatibility: ${compatible.length}/${totalPackages} packages (${compatPercent}%)`)

    if (incompatible.length > 0) {
      console.log(
        `  ⚠️ Incompatible with: ${incompatible.slice(0, 3).join(", ")}${incompatible.length > 3 ? ` and ${incompatible.length - 3} more` : ""}`,
      )
    }
  }

  console.log("\n⚠️ Some peer dependencies are not fully compatible with all packages.")
  console.log("   This could lead to runtime errors or unexpected behavior.")
}

// Create a temporary package.json with resolved peer dependencies
async function createTemporaryPackageJson(peerDeps, packageManager, originalPackageJson = null) {
  try {
    // Read the current package.json if not provided
    const packageJson = originalPackageJson || (await readPackageJsonWithCache("./package.json"))

    // Backup original package.json
    await fs.writeFile("package.json.backup", JSON.stringify(packageJson, null, 2))

    // Add resolved peer dependencies to devDependencies
    packageJson.devDependencies = packageJson.devDependencies || {}

    // Track how many dependencies were added
    let addedCount = 0

    for (const [dep, version] of Object.entries(peerDeps)) {
      // Only add if not already in dependencies or devDependencies
      if ((!packageJson.dependencies || !packageJson.dependencies[dep]) && !packageJson.devDependencies[dep]) {
        packageJson.devDependencies[dep] = version
        addedCount++
      }
    }

    if (addedCount > 0) {
      console.log(`➕ Added ${addedCount} peer dependencies to devDependencies`)
    }

    // Detect critical dependencies and problematic packages
    const criticalDeps = detectCriticalDependencies(packageJson)
    const isMonorepo = await detectMonorepo()
    const problematicPackages = detectProblematicPackages(packageJson)

    // Add package manager specific configuration
    switch (packageManager) {
      case PACKAGE_MANAGERS.NPM:
        // For npm, add legacy_peer_deps config
        packageJson.npmConfig = packageJson.npmConfig || {}
        packageJson.npmConfig.legacy_peer_deps = true
        break

      case PACKAGE_MANAGERS.YARN:
        // For yarn, add resolutions for conflicting dependencies
        packageJson.resolutions = packageJson.resolutions || {}
        for (const [dep, version] of Object.entries(peerDeps)) {
          packageJson.resolutions[dep] = version
        }
        break

      case PACKAGE_MANAGERS.PNPM:
        // For pnpm, add comprehensive configuration
        packageJson.pnpm = packageJson.pnpm || {}

        // Handle dependency overrides
        packageJson.pnpm.overrides = packageJson.pnpm.overrides || {}
        for (const [dep, version] of Object.entries(peerDeps)) {
          packageJson.pnpm.overrides[dep] = version
        }

        // Configure peer dependency rules
        packageJson.pnpm.peerDependencyRules = packageJson.pnpm.peerDependencyRules || {}
        packageJson.pnpm.peerDependencyRules.allowedVersions =
          packageJson.pnpm.peerDependencyRules.allowedVersions || {}

        // Add allowed versions for critical dependencies
        for (const [dep, version] of Object.entries(peerDeps)) {
          if (criticalDeps.includes(dep)) {
            packageJson.pnpm.peerDependencyRules.allowedVersions[dep] = version
          }
        }

        // Configure ignored peer dependencies for problematic packages
        packageJson.pnpm.peerDependencyRules.ignoreMissing = packageJson.pnpm.peerDependencyRules.ignoreMissing || []

        // Add any detected problematic packages to the ignore list
        for (const [pkg, missingPeers] of Object.entries(problematicPackages)) {
          for (const peer of Object.keys(missingPeers)) {
            // Add in format packageName > peerDependency
            const ignoreEntry = `${pkg} > ${peer}`
            if (!packageJson.pnpm.peerDependencyRules.ignoreMissing.includes(ignoreEntry)) {
              packageJson.pnpm.peerDependencyRules.ignoreMissing.push(ignoreEntry)
            }
          }
        }
        break
    }

    // Add additional configuration for monorepos
    if (isMonorepo) {
      console.log("📦 Detected monorepo structure, adding appropriate configuration...")

      // Set hoisting and strict peer dependencies in pnpm
      if (packageManager === PACKAGE_MANAGERS.PNPM) {
        packageJson.pnpm = packageJson.pnpm || {}
        packageJson.pnpm.hoistingLimits = "workspaces"
      }

      // For yarn workspaces, add nohoist patterns for problematic packages
      if (packageManager === PACKAGE_MANAGERS.YARN && packageJson.workspaces) {
        packageJson.workspaces = packageJson.workspaces || {}
        packageJson.workspaces.nohoist = packageJson.workspaces.nohoist || []

        // Add nohoist patterns for critical dependencies
        for (const dep of criticalDeps) {
          const nohoistPattern = `**/${dep}/**`
          if (!packageJson.workspaces.nohoist.includes(nohoistPattern)) {
            packageJson.workspaces.nohoist.push(nohoistPattern)
          }
        }
      }
    }

    // Write the enhanced package.json
    await fs.writeFile("package.json", JSON.stringify(packageJson, null, 2))

    console.log("📝 Created temporary package.json with enhanced peer dependency configuration")
  } catch (error) {
    console.error("❌ Error creating temporary package.json:", error)
    throw error
  }
}

// Detect if this is a monorepo
async function detectMonorepo() {
  try {
    const packageJson = await readPackageJsonWithCache("./package.json")

    // Check for common monorepo indicators
    if (packageJson.workspaces) {
      return true
    }

    // Check for lerna.json
    if (existsSync("lerna.json")) {
      return true
    }

    // Check for pnpm-workspace.yaml
    if (existsSync("pnpm-workspace.yaml")) {
      return true
    }

    // Check for common monorepo directory structures
    const commonMonorepoDirs = ["packages", "apps", "libs", "modules"]
    for (const dir of commonMonorepoDirs) {
      if (existsSync(dir)) {
        try {
          const stats = await fs.stat(dir)
          if (stats.isDirectory()) {
            const entries = await fs.readdir(dir)
            if (entries.length > 0) {
              return true
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }

    return false
  } catch (e) {
    return false
  }
}

// Detect critical dependencies that often cause conflicts
function detectCriticalDependencies(packageJson) {
  const criticalDeps = []
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  // Check for known critical dependencies
  for (const dep of KNOWN_CRITICAL_DEPS) {
    if (allDependencies[dep]) {
      criticalDeps.push(dep)
    }
  }

  console.log(`🔍 Detected ${criticalDeps.length} critical dependencies`)

  return criticalDeps
}

// Detect problematic packages with missing peer dependencies
function detectProblematicPackages(packageJson) {
  const problematicPackages = {}
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  // Check for known problematic packages
  for (const [pkg, missingPeers] of Object.entries(KNOWN_PROBLEMATIC_PACKAGES)) {
    if (allDependencies[pkg]) {
      // Check if the required peer dependencies are missing
      const missingPeerDeps = {}

      for (const [peer, version] of Object.entries(missingPeers)) {
        if (!allDependencies[peer]) {
          missingPeerDeps[peer] = version
        }
      }

      if (Object.keys(missingPeerDeps).length > 0) {
        problematicPackages[pkg] = missingPeerDeps
      }
    }
  }

  if (Object.keys(problematicPackages).length > 0) {
    console.log(
      `⚠️ Detected ${Object.keys(problematicPackages).length} packages with potentially missing peer dependencies`,
    )
  }

  return problematicPackages
}

// Restore the original package.json
async function restoreOriginalPackageJson() {
  try {
    if (existsSync("package.json.backup")) {
      await fs.copyFile("package.json.backup", "package.json")
      await fs.unlink("package.json.backup")
      console.log("📄 Restored original package.json")
    }
  } catch (error) {
    console.error("❌ Error restoring original package.json:", error)
    throw error
  }
}

// Pass through command to package manager
function passthrough(args, packageManager) {
  try {
    const command = `${packageManager} ${args.join(" ")}`
    console.log(`🚀 Executing: ${command}`)
    execSync(command, { stdio: "inherit" })
  } catch (error) {
    console.error("❌ Error executing package manager command:", error)
    process.exit(1)
  }
}

async function handleScanCommand(args) {
  try {
    console.log("🔍 Scanning for unused dependencies...")

    // Check if required dependencies are installed
    const requiredDeps = ["glob"]
    const missingDeps = []

    for (const dep of requiredDeps) {
      try {
        // Try to dynamically import the dependency
        await import(dep)
      } catch (error) {
        if (error.code === "ERR_MODULE_NOT_FOUND") {
          missingDeps.push(dep)
        }
      }
    }

    // If there are missing dependencies, inform the user and exit
    if (missingDeps.length > 0) {
      console.error(`❌ Missing required dependencies for scanning: ${missingDeps.join(", ")}`)
      console.error("\nPlease install the missing dependencies:")
      console.error(`npm install --save-dev ${missingDeps.join(" ")}`)
      console.error("\nOr run:")
      console.error("epd install-scanner")
      return 1
    }

    // Now that we've confirmed dependencies are available, import the scanner
    const { scanUnusedDependencies, generateUnusedDependenciesReport, calculateDiskSpaceSavings } = await import(
      "./dependency-scanner.js"
    )

    const options = {
      directory: process.cwd(),
      includeDevDependencies: !args.includes("--production"),
      includePeerDependencies: args.includes("--include-peer-deps"),
      includeOptionalDependencies: args.includes("--include-optional-deps"),
      ignoreSpecialDependencies: !args.includes("--strict"),
      verbose: args.includes("--verbose"),
    }

    const result = await scanUnusedDependencies(options)
    generateUnusedDependenciesReport(result)

    const unusedDeps = { ...result.unused }
    if (args.includes("--include-potential")) {
      Object.assign(unusedDeps, result.potentiallyUnused)
    }

    if (Object.keys(unusedDeps).length > 0) {
      const sizeMB = await calculateDiskSpaceSavings(unusedDeps, options.directory)
      if (sizeMB > 0) {
        console.log(`\n💾 Potential disk space savings: ${sizeMB.toFixed(1)} MB`)
      }
    }

    return 0
  } catch (error) {
    console.error("❌ Error scanning dependencies:", error)
    return 1
  }
}

// Handle the installation of scanner dependencies
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

// Execute main function
main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})
