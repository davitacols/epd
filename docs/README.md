# EPD Documentation

## Table of Contents
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Installation
```bash
npm install -g epd
```

### Basic Usage
```bash
# Install dependencies with smart peer dependency resolution
epd install

# Add new packages
epd add react react-dom

# Scan for issues
epd scan
epd health --score
epd security
```

## Commands

### Core Commands

#### `epd install`
Install dependencies with enhanced peer dependency resolution.
```bash
epd install                    # Install all dependencies
epd add react@18.2.0          # Add specific package
epd install --pm=yarn         # Force package manager
```

#### `epd resolve`
Smart conflict resolution for peer dependencies.
```bash
epd resolve                    # Smart resolution
epd resolve --stable           # Prefer stable versions
epd resolve --ai               # AI-powered resolution
```

### Analysis Commands

#### `epd scan`
Scan for unused dependencies.
```bash
epd scan                       # Basic scan
epd scan --verbose             # Detailed output
```

#### `epd health`
Analyze dependency health scores.
```bash
epd health --score             # Show health scores
epd health --recommendations   # Get recommendations
```

#### `epd security`
Security vulnerability scanning.
```bash
epd security                   # Run security scan
```

#### `epd why <package>`
Show why a package is needed.
```bash
epd why react                  # Show dependency chain
```

#### `epd tree`
Display dependency tree.
```bash
epd tree                       # Full dependency tree
epd tree --conflicts-only      # Show only conflicts
```

#### `epd impact <package>`
Analyze bundle size impact.
```bash
epd impact lodash              # Show size impact
```

### Optimization Commands

#### `epd optimize`
Workspace optimization for monorepos.
```bash
epd optimize --hoist           # Hoist common dependencies
epd optimize --dedupe          # Remove duplicates
```

#### `epd update`
Safe dependency updates.
```bash
epd update --safe              # Safe updates only
epd update --breaking-changes  # Include breaking changes
```

### Compliance Commands

#### `epd licenses`
License compliance checking.
```bash
epd licenses                   # Quick check
epd licenses --report          # Detailed report
```

### Utility Commands

#### `epd conflicts`
Interactive conflict resolution.
```bash
epd conflicts                  # Interactive mode
epd conflicts --fix            # Auto-fix conflicts
```

#### `epd doctor`
Health diagnostics.
```bash
epd doctor                     # Run diagnostics
```

#### `epd fix`
Auto-fix common issues.
```bash
epd fix                        # Fix all issues
epd fix duplicates             # Fix specific issue
```

## Configuration

### .epdrc Configuration File
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

### Environment Variables
```bash
EPD_PACKAGE_MANAGER=npm        # Force package manager
EPD_DEBUG=true                 # Enable debug mode
EPD_REGISTRY=https://...       # Custom registry
```

## Examples

### Monorepo Setup
```bash
# Initialize workspace
epd install

# Optimize dependencies
epd optimize --hoist

# Check health across workspace
epd health --score --recommendations
```

### CI/CD Integration
```bash
# Security and compliance check
epd security && epd licenses

# Update dependencies safely
epd update --safe

# Verify no unused dependencies
epd scan
```

### Development Workflow
```bash
# Add new dependency
epd add @mui/material

# Check impact
epd impact @mui/material

# Resolve any conflicts
epd resolve --smart

# Verify health
epd health --score
```

## Troubleshooting

### Common Issues

#### Package Manager Not Found
```bash
# Install required package manager
npm install -g yarn
# or
npm install -g pnpm
```

#### Registry Connection Issues
```bash
# Check network connection
# Verify registry configuration
npm config get registry
```

#### Peer Dependency Conflicts
```bash
# Use interactive resolution
epd conflicts

# Or smart resolution
epd resolve --smart
```

### Debug Mode
```bash
epd install --debug            # Enable verbose logging
```

### Getting Help
```bash
epd --help                     # Show all commands
epd <command> --help           # Command-specific help
```