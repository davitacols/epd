# Enhanced Peer Dependencies (epd)

[![npm version](https://img.shields.io/npm/v/epd)](https://www.npmjs.com/package/epd)
[![CI](https://github.com/davitacols/epd/actions/workflows/ci.yml/badge.svg)](https://github.com/davitacols/epd/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/davitacols/epd)](https://github.com/davitacols/epd/blob/main/LICENSE)

A smart CLI tool that intelligently resolves peer dependency conflicts across npm, yarn, and pnpm projects.

## 🌟 Features

- **Intelligent Resolution**: Automatically finds the best version that satisfies the most peer dependency requirements
- **Multi-Package Manager Support**: Works with npm, yarn, and pnpm
- **Workspace Aware**: Handles monorepo structures with multiple packages
- **Registry Integration**: Queries npm registry for available versions
- **Detailed Reporting**: Shows conflicts and resolution strategies
- **Non-Destructive**: Preserves your original package.json
- **Zero Configuration**: Works out of the box

## 📦 Installation

```bash
# Install globally
npm install -g epd

# Or with yarn
yarn global add epd

# Or with pnpm
pnpm add -g epd
```

## 🚀 Usage

Use `epd` as a drop-in replacement for your package manager's install command:

### Installing Dependencies from package.json

```shellscript
# Install all dependencies from package.json
epd install

# Or simply
epd
```

### Adding New Packages

```shellscript
# Add a new package
epd add react

# Add multiple packages
epd add react react-dom

# Add with specific version
epd add react@18.2.0
```

### Enhanced Features

```shellscript
# Scan for unused dependencies
epd scan

# Check for security vulnerabilities
epd security

# Check for outdated dependencies
epd outdated

# Interactive dependency resolution
epd interactive

# View current configuration
epd config
```

### Specifying Package Manager

By default, epd automatically detects your package manager based on lockfiles or availability. You can override this with the `--pm` flag:

```shellscript
# Force using npm
epd install --pm=npm

# Force using yarn
epd add react --pm=yarn

# Force using pnpm
epd add react --pm=pnpm
```

## 🔍 How It Works

When you run `epd`, it:

1. **Analyzes** your project structure and detects workspaces
2. **Collects** all peer dependencies from all packages
3. **Resolves** version conflicts using a sophisticated algorithm:
   - First tries to find a version that satisfies all requirements
   - If none exists, queries the npm registry for available versions
   - Selects the version that satisfies the most requirements
4. **Creates** a temporary package.json with the resolved dependencies
5. **Installs** packages using your preferred package manager
6. **Restores** your original package.json


## 🛠️ Command Line Options

| Option | Description |
|--------|-------------|
| `--pm=<manager>` | Force a specific package manager (npm, yarn, pnpm) |
| `--debug` | Enable debug mode with verbose logging |
| `--interactive` | Enable interactive conflict resolution |
| `--config=<path>` | Use custom configuration file |

## ⚙️ Configuration

Create a `.epdrc` file in your project root:

```json
{
  "packageManager": "npm",
  "autoResolve": true,
  "interactive": false,
  "ignorePackages": ["@types/node"],
  "preferredVersions": {
    "react": "^18.0.0"
  },
  "timeout": 30000,
  "retries": 3
}
```


## ⚠️ Troubleshooting

### Package Manager Not Found

If you see an error like:

```plaintext
❌ Forced package manager pnpm is not installed or not in PATH
```

Make sure the specified package manager is installed and available in your PATH.

### Registry Connection Issues

If you encounter registry connection problems:

```plaintext
❌ Error fetching versions for react: HTTP error! Status: 404
```

Check your internet connection and ensure you have access to the npm registry. If you're using a custom registry, verify it's correctly configured in your npm settings.

### Command Not Found

If you see:

```plaintext
Command 'epd' not found
```

Ensure the package is properly installed globally. You may need to add the npm global bin directory to your PATH.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- Inspired by npm's `--legacy-peer-deps` flag
- Built with love for the JavaScript community

## 🔄 Recent Updates

The following improvements have been made to the project:

- **TypeScript Migration**: The entire codebase has been converted to TypeScript for improved type safety and developer experience. Type definitions are now available for all core interfaces and functions.

- **Unit Testing**: A comprehensive test suite has been added using Node's native test runner, covering core functionality like dependency scanning and report generation.

- **Type Definitions**: Added robust TypeScript interfaces for:
  - Package information and scanning options
  - Scan results and reports
  - Package.json structure
  - Package manager types

These changes improve code quality, maintainability, and developer experience while ensuring reliable functionality through automated testing.