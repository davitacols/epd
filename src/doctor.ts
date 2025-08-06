import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { PackageJson } from './types.js';

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export async function runHealthCheck(packageJson: PackageJson): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // Check Node.js version
  try {
    const nodeVersion = process.version;
    const engines = packageJson.engines?.node;
    checks.push({
      name: 'Node.js Version',
      status: engines ? 'pass' : 'warn',
      message: engines ? `${nodeVersion} (matches ${engines})` : `${nodeVersion} (no engine constraint)`
    });
  } catch (e) {
    checks.push({
      name: 'Node.js Version',
      status: 'fail',
      message: 'Could not detect Node.js version'
    });
  }

  // Check lockfile consistency
  const hasPackageLock = existsSync('package-lock.json');
  const hasYarnLock = existsSync('yarn.lock');
  const hasPnpmLock = existsSync('pnpm-lock.yaml');
  
  const lockCount = [hasPackageLock, hasYarnLock, hasPnpmLock].filter(Boolean).length;
  checks.push({
    name: 'Lockfile Consistency',
    status: lockCount === 1 ? 'pass' : lockCount > 1 ? 'warn' : 'fail',
    message: lockCount === 1 ? 'Single lockfile found' : 
             lockCount > 1 ? 'Multiple lockfiles detected' : 'No lockfile found'
  });

  // Check for duplicate dependencies
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const duplicates = Object.keys(packageJson.dependencies || {})
    .filter(dep => packageJson.devDependencies?.[dep]);
  
  checks.push({
    name: 'Duplicate Dependencies',
    status: duplicates.length === 0 ? 'pass' : 'warn',
    message: duplicates.length === 0 ? 'No duplicates found' : 
             `Found ${duplicates.length} duplicates: ${duplicates.join(', ')}`
  });

  return checks;
}

export function generateHealthReport(checks: HealthCheck[]): void {
  console.log('\n🏥 Project Health Report:');
  
  checks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : 
                 check.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}: ${check.message}`);
  });
  
  const summary = checks.reduce((acc, check) => {
    acc[check.status]++;
    return acc;
  }, { pass: 0, warn: 0, fail: 0 });
  
  console.log(`\nSummary: ${summary.pass} passed, ${summary.warn} warnings, ${summary.fail} failed`);
}