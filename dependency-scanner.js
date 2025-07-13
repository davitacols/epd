import fs from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { execSync } from "child_process"
import { promisify } from "util"

// Try to import glob, but provide a fallback if it's not available
let glob
let globPromise

try {
  glob = await import("glob").then((module) => module.default)
  globPromise = promisify(glob)
} catch (error) {
  // Create a dummy function that will throw a more helpful error
  globPromise = () => {
    throw new Error(
      "The 'glob' package is required for dependency scanning. " +
        "Please install it with 'npm install --save-dev glob' or run 'epd install-scanner'.",
    )
  }
}

// Common file extensions to scan
const FILE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".mjs", ".cjs", ".mts", ".cts"]

// Files and directories to ignore
const IGNORE_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.git/**"]

// Special dependencies that might not be directly imported
const SPECIAL_DEPENDENCIES = new Set([
  // Build tools and CLI tools
  "webpack",
  "babel",
  "eslint",
  "prettier",
  "typescript",
  "jest",
  "mocha",
  "chai",
  "ava",
  "nyc",
  "parcel",
  "rollup",
  "vite",
  "esbuild",
  "tsc",
  "tslint",

  // Runtime dependencies that might be used indirectly
  "core-js",
  "regenerator-runtime",
  "tslib",

  // CSS processors
  "sass",
  "less",
  "stylus",
  "postcss",

  // Common dev tools
  "nodemon",
  "concurrently",
  "npm-run-all",
  "rimraf",
  "cross-env",
  "dotenv",
  "husky",
  "lint-staged",
])

// Dependencies that might be used via configuration files
const CONFIG_FILE_DEPENDENCIES = {
  eslint: [".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml"],
  babel: ["babel.config.js", ".babelrc", ".babelrc.js", ".babelrc.json"],
  jest: ["jest.config.js", "jest.config.ts"],
  prettier: [".prettierrc", ".prettierrc.js", ".prettierrc.json"],
  webpack: ["webpack.config.js", "webpack.config.ts"],
  rollup: ["rollup.config.js", "rollup.config.ts"],
  postcss: ["postcss.config.js"],
  tailwindcss: ["tailwind.config.js", "tailwind.config.ts"],
  vite: ["vite.config.js", "vite.config.ts"],
  next: ["next.config.js", "next.config.mjs"],
  nuxt: ["nuxt.config.js", "nuxt.config.ts"],
}

/**
 * Scans the codebase to identify unused dependencies
 */
export async function scanUnusedDependencies(options = {}) {
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
    const packageJson = await readPackageJson(directory)
    const declaredDependencies = getDeclaredDependencies(
      packageJson,
      includeDevDependencies,
      includePeerDependencies,
      includeOptionalDependencies,
    )

    if (verbose) {
      console.log(`📦 Found ${Object.keys(declaredDependencies).length} declared dependencies`)
    }

    // Step 2: Find all source files
    const sourceFiles = await findSourceFiles(directory)

    if (verbose) {
      console.log(`📄 Found ${sourceFiles.length} source files to scan`)
    }

    // Step 3: Scan files for imports/requires
    const usedDependencies = await findUsedDependencies(sourceFiles, directory)

    if (verbose) {
      console.log(`🔗 Found ${usedDependencies.size} dependencies used in code`)
    }

    // Step 4: Check for dependencies used in scripts
    const scriptDependencies = findScriptDependencies(packageJson)
    scriptDependencies.forEach((dep) => usedDependencies.add(dep))

    if (verbose && scriptDependencies.size > 0) {
      console.log(`📜 Found ${scriptDependencies.size} dependencies used in npm scripts`)
    }

    // Step 5: Check for dependencies used in config files
    const configDependencies = await findConfigDependencies(directory)
    configDependencies.forEach((dep) => usedDependencies.add(dep))

    if (verbose && configDependencies.size > 0) {
      console.log(`⚙️ Found ${configDependencies.size} dependencies used in config files`)
    }

    // Step 6: Identify unused dependencies
    const unusedDependencies = {}
    const potentiallyUnusedDependencies = {}

    for (const [name, info] of Object.entries(declaredDependencies)) {
      if (!usedDependencies.has(name)) {
        // Check if it's a special dependency that might not be directly imported
        if (ignoreSpecialDependencies && SPECIAL_DEPENDENCIES.has(name)) {
          potentiallyUnusedDependencies[name] = info
        } else {
          unusedDependencies[name] = info
        }
      }
    }

    // Step 7: Check for transitive dependencies
    const transitiveDependencies = await findTransitiveDependencies(Object.keys(unusedDependencies), directory)

    // Remove dependencies that are required by other packages
    for (const [dep, requiredBy] of Object.entries(transitiveDependencies)) {
      if (unusedDependencies[dep]) {
        if (verbose) {
          console.log(`⚠️ ${dep} appears unused but is required by: ${requiredBy.join(", ")}`)
        }
        potentiallyUnusedDependencies[dep] = unusedDependencies[dep]
        potentiallyUnusedDependencies[dep].requiredBy = requiredBy
        delete unusedDependencies[dep]
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

/**
 * Reads the package.json file
 */
async function readPackageJson(directory) {
  try {
    const packageJsonPath = path.join(directory, "package.json")
    const content = await fs.readFile(packageJsonPath, "utf8")
    return JSON.parse(content)
  } catch (error) {
    throw new Error(`Failed to read package.json: ${error.message}`)
  }
}

/**
 * Gets all declared dependencies from package.json
 */
function getDeclaredDependencies(
  packageJson,
  includeDevDependencies,
  includePeerDependencies,
  includeOptionalDependencies,
) {
  const dependencies = {}

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

/**
 * Finds all source files in the project
 */
async function findSourceFiles(directory) {
  const pattern = `**/*+(${FILE_EXTENSIONS.join("|")})`

  try {
    // Check if globPromise is available
    if (!globPromise) {
      throw new Error(
        "The 'glob' package is required for dependency scanning. " +
          "Please install it with 'npm install --save-dev glob' or run 'epd install-scanner'.",
      )
    }

    return await globPromise(pattern, {
      cwd: directory,
      ignore: IGNORE_PATTERNS,
      absolute: true,
      nodir: true,
    })
  } catch (error) {
    if (error.message.includes("glob")) {
      throw new Error(
        "The 'glob' package is required for dependency scanning. " +
          "Please install it with 'npm install --save-dev glob' or run 'epd install-scanner'.",
      )
    }
    throw new Error(`Failed to find source files: ${error.message}`)
  }
}

/**
 * Scans files for import/require statements to find used dependencies
 */
async function findUsedDependencies(sourceFiles, directory) {
  const usedDependencies = new Set()
  const packageNameRegex = /^((?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*)(?:\/.*)?$/

  // Regular expressions for different import patterns
  const importPatterns = [
    // ES6 imports
    /import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/g,
    // CommonJS require
    /require\s*$$\s*['"]([^'"]+)['"]\s*$$/g,
    // Dynamic imports
    /import\s*$$\s*['"]([^'"]+)['"]\s*$$/g,
    // TypeScript import type
    /import\s+type\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/g,
    // CSS/SCSS imports
    /@import\s+['"]([^'"]+)['"]/g,
    // Webpack/Vite specific imports
    /import\s+['"]([^'"]+\.(?:css|scss|less|styl))['"]/g,
  ]

  for (const file of sourceFiles) {
    try {
      const content = await fs.readFile(file, "utf8")

      for (const pattern of importPatterns) {
        let match
        pattern.lastIndex = 0 // Reset regex state

        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1]

          // Skip relative imports and absolute paths
          if (importPath.startsWith(".") || importPath.startsWith("/")) {
            continue
          }

          // Extract the package name (e.g., 'lodash/fp' -> 'lodash')
          const packageMatch = importPath.match(packageNameRegex)
          if (packageMatch && packageMatch[1]) {
            usedDependencies.add(packageMatch[1])
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not read file ${file}: ${error.message}`)
    }
  }

  return usedDependencies
}

/**
 * Finds dependencies used in npm scripts
 */
function findScriptDependencies(packageJson) {
  const scriptDependencies = new Set()

  if (!packageJson.scripts) {
    return scriptDependencies
  }

  // Common CLI commands that might be used in scripts
  const cliCommands = [
    "webpack",
    "babel",
    "eslint",
    "prettier",
    "tsc",
    "jest",
    "mocha",
    "nyc",
    "parcel",
    "rollup",
    "vite",
    "next",
    "nuxt",
    "gatsby",
    "ng",
    "vue-cli-service",
    "react-scripts",
    "nodemon",
    "ts-node",
    "rimraf",
    "cross-env",
    "concurrently",
    "npm-run-all",
  ]

  for (const script of Object.values(packageJson.scripts)) {
    for (const command of cliCommands) {
      // Check if the script uses the command
      if (
        script.includes(`${command} `) ||
        script.includes(`npx ${command}`) ||
        script.includes(`yarn ${command}`) ||
        script.includes(`pnpm ${command}`) ||
        script === command
      ) {
        scriptDependencies.add(command)

        // Handle special cases
        if (command === "react-scripts") {
          scriptDependencies.add("react")
          scriptDependencies.add("react-dom")
        } else if (command === "vue-cli-service") {
          scriptDependencies.add("vue")
        } else if (command === "ng") {
          scriptDependencies.add("@angular/core")
        }
      }
    }
  }

  return scriptDependencies
}

/**
 * Finds dependencies used in configuration files
 */
async function findConfigDependencies(directory) {
  const configDependencies = new Set()

  for (const [dep, configFiles] of Object.entries(CONFIG_FILE_DEPENDENCIES)) {
    for (const configFile of configFiles) {
      const configPath = path.join(directory, configFile)

      if (existsSync(configPath)) {
        configDependencies.add(dep)
        break
      }
    }
  }

  return configDependencies
}

/**
 * Finds transitive dependencies (dependencies required by other packages)
 */
async function findTransitiveDependencies(dependencies, directory) {
  const transitiveDependencies = {}

  if (dependencies.length === 0) {
    return transitiveDependencies
  }

  try {
    // For each potentially unused dependency, check if it's required by other packages
    for (const dep of dependencies) {
      const nodeModulesPath = path.join(directory, "node_modules")

      if (!existsSync(nodeModulesPath)) {
        continue
      }

      // Find all package.json files in node_modules
      const packageJsonFiles = await globPromise("**/package.json", {
        cwd: nodeModulesPath,
        ignore: ["**/node_modules/**"],
        absolute: true,
      })

      const requiredBy = []

      for (const packageJsonFile of packageJsonFiles) {
        try {
          const content = await fs.readFile(packageJsonFile, "utf8")
          const pkg = JSON.parse(content)
          const pkgName = pkg.name

          // Skip the dependency itself
          if (pkgName === dep) {
            continue
          }

          // Check if this package depends on our dependency
          const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
            ...pkg.peerDependencies,
          }

          if (allDeps && allDeps[dep]) {
            requiredBy.push(pkgName)
          }
        } catch (error) {
          // Ignore errors reading individual package.json files
        }
      }

      if (requiredBy.length > 0) {
        transitiveDependencies[dep] = requiredBy
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error checking transitive dependencies: ${error.message}`)
  }

  return transitiveDependencies
}

/**
 * Generates a report of unused dependencies
 */
export function generateUnusedDependenciesReport(result) {
  const { unused, potentiallyUnused, total, scannedFiles } = result

  const unusedCount = Object.keys(unused).length
  const potentiallyUnusedCount = Object.keys(potentiallyUnused).length

  console.log("\n📊 Unused Dependencies Report")
  console.log("============================")
  console.log(`Total dependencies: ${total}`)
  console.log(`Files scanned: ${scannedFiles}`)
  console.log(`Unused dependencies: ${unusedCount}`)
  console.log(`Potentially unused dependencies: ${potentiallyUnusedCount}`)

  if (unusedCount > 0) {
    console.log("\n❌ Unused Dependencies:")
    console.log("These dependencies appear to be completely unused and can likely be removed:")

    for (const [name, info] of Object.entries(unused)) {
      console.log(`  - ${name}@${info.version} (${info.type})`)
    }

    console.log("\nTo remove these dependencies, run:")
    console.log(`npm uninstall ${Object.keys(unused).join(" ")}`)
  }

  if (potentiallyUnusedCount > 0) {
    console.log("\n⚠️ Potentially Unused Dependencies:")
    console.log("These dependencies might be used indirectly or through configuration:")

    for (const [name, info] of Object.entries(potentiallyUnused)) {
      if (info.requiredBy) {
        console.log(`  - ${name}@${info.version} (${info.type}) - required by: ${info.requiredBy.join(", ")}`)
      } else {
        console.log(`  - ${name}@${info.version} (${info.type}) - might be used indirectly`)
      }
    }
  }

  if (unusedCount === 0 && potentiallyUnusedCount === 0) {
    console.log("\n✅ No unused dependencies found! Your project is well-optimized.")
  }

  return {
    unusedCount,
    potentiallyUnusedCount,
    totalDependencies: total,
    filesScanned: scannedFiles,
  }
}

/**
 * Calculates the potential disk space savings from removing unused dependencies
 */
export async function calculateDiskSpaceSavings(unusedDependencies, directory) {
  let totalSizeMB = 0

  try {
    for (const dep of Object.keys(unusedDependencies)) {
      const depPath = path.join(directory, "node_modules", dep)

      if (existsSync(depPath)) {
        // Use du command on Unix-like systems
        try {
          const output = execSync(`du -sm "${depPath}"`, { encoding: "utf8" })
          const size = Number.parseFloat(output.split("\t")[0])
          totalSizeMB += size
        } catch (error) {
          // Fallback to a rough estimation
          totalSizeMB += 0.5 // Assume 0.5MB per dependency as a fallback
        }
      }
    }

    return totalSizeMB
  } catch (error) {
    console.warn(`⚠️ Could not calculate disk space savings: ${error.message}`)
    return 0
  }
}
