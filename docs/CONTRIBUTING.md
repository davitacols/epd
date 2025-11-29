# Contributing to EPD

## Development Setup

### Prerequisites
- Node.js 16+
- npm/yarn/pnpm
- TypeScript knowledge

### Local Development
```bash
# Clone repository
git clone https://github.com/davitacols/epd.git
cd epd

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Project Structure

```
epd/
├── src/                    # Source code
│   ├── index.ts           # Main CLI entry
│   ├── types.ts           # TypeScript definitions
│   ├── smart-resolver.ts  # Conflict resolution
│   ├── health-checker.ts  # Dependency health
│   ├── workspace-optimizer.ts # Workspace optimization
│   ├── dependency-analyzer.ts # Analysis tools
│   ├── license-checker.ts # License compliance
│   ├── auto-updater.ts    # Safe updates
│   ├── registry.ts        # NPM registry integration
│   ├── security.ts        # Security scanning
│   └── ...               # Other modules
├── test/                  # Test files
├── docs/                  # Documentation
├── dist/                  # Compiled output
└── package.json
```

## Adding New Features

### 1. Create Module
```typescript
// src/new-feature.ts
export interface NewFeatureOptions {
  option1: string;
  option2?: boolean;
}

export async function newFeature(options: NewFeatureOptions): Promise<void> {
  // Implementation
}
```

### 2. Add Command Handler
```typescript
// In src/index.ts
case "new-command":
  process.exit(await handleNewCommand(args.originalArgs))

// Add handler function
async function handleNewCommand(args: string[]): Promise<number> {
  try {
    const { newFeature } = await import('./new-feature.js')
    await newFeature({ option1: 'value' })
    return 0
  } catch (error) {
    console.error('❌ New feature failed:', error)
    return 1
  }
}
```

### 3. Add Tests
```typescript
// test/new-feature.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('New Feature', () => {
  it('should work correctly', () => {
    // Test implementation
    assert.ok(true)
  })
})
```

### 4. Update Documentation
- Add to `docs/README.md`
- Add to `docs/API.md`
- Add examples to `docs/EXAMPLES.md`

## Code Standards

### TypeScript Guidelines
```typescript
// Use strict typing
interface StrictInterface {
  required: string;
  optional?: number;
}

// Prefer async/await
async function asyncFunction(): Promise<Result> {
  try {
    const result = await someOperation()
    return result
  } catch (error) {
    throw new Error(`Operation failed: ${error}`)
  }
}

// Use proper error handling
function handleError(error: unknown): void {
  console.error('❌ Error:', error)
}
```

### Code Style
```typescript
// Use meaningful names
const packageVersionCache = new Map<string, string[]>()

// Prefer const over let
const config = await loadConfig()

// Use template literals
console.log(`✅ Processed ${count} packages`)

// Destructure when appropriate
const { dependencies, devDependencies } = packageJson
```

## Testing Guidelines

### Unit Tests
```typescript
describe('Module Name', () => {
  it('should handle normal case', () => {
    const result = functionUnderTest('input')
    assert.strictEqual(result, 'expected')
  })

  it('should handle error case', () => {
    assert.throws(() => {
      functionUnderTest('invalid')
    }, /Expected error message/)
  })
})
```

### Integration Tests
```typescript
describe('CLI Integration', () => {
  it('should execute command successfully', async () => {
    const result = await executeCommand(['scan'])
    assert.strictEqual(result.exitCode, 0)
  })
})
```

## Pull Request Process

### 1. Branch Naming
```bash
git checkout -b feature/smart-resolution
git checkout -b fix/security-scan-bug
git checkout -b docs/api-reference
```

### 2. Commit Messages
```bash
git commit -m "feat: add smart conflict resolution"
git commit -m "fix: handle registry timeout errors"
git commit -m "docs: update API reference"
```

### 3. PR Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Build passes
- [ ] No breaking changes (or documented)

### 4. PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

## Release Process

### Version Bumping
```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features)
npm version minor

# Major release (breaking changes)
npm version major
```

### Publishing
```bash
# Build and test
npm run build
npm test

# Publish to npm
npm publish
```

## Architecture Decisions

### Module Design
- Each feature in separate module
- Clear interfaces and types
- Minimal dependencies between modules
- Error handling at module boundaries

### CLI Design
- Command-based architecture
- Consistent argument parsing
- Helpful error messages
- Progress indicators for long operations

### Performance Considerations
- Cache registry requests
- Parallel operations where possible
- Minimal file I/O
- Efficient algorithms for large workspaces

## Getting Help

### Development Questions
- Check existing issues
- Review documentation
- Ask in discussions

### Bug Reports
Use issue template:
```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Run command X
2. See error Y

**Expected Behavior**
What should happen

**Environment**
- OS: 
- Node version:
- EPD version:
```

### Feature Requests
```markdown
**Feature Description**
Clear description of proposed feature

**Use Case**
Why is this feature needed

**Proposed Solution**
How should it work

**Alternatives**
Other solutions considered
```