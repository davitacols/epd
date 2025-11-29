import fs from 'fs/promises';
import { PackageJson } from './types.js';
import { fetchPackageVersions } from './registry.js';

export interface UpdatePlan {
  package: string;
  current: string;
  target: string;
  type: 'patch' | 'minor' | 'major';
  breaking: boolean;
  safe: boolean;
}

export async function planSafeUpdates(packageJson: PackageJson): Promise<UpdatePlan[]> {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const plans: UpdatePlan[] = [];
  
  for (const [pkg, currentVersion] of Object.entries(deps)) {
    const plan = await createUpdatePlan(pkg, currentVersion);
    if (plan) plans.push(plan);
  }
  
  return plans.filter(p => p.safe);
}

export async function applyUpdates(plans: UpdatePlan[], breakingChanges = false): Promise<void> {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
  let updated = false;
  
  for (const plan of plans) {
    if (plan.safe || (breakingChanges && plan.breaking)) {
      if (packageJson.dependencies?.[plan.package]) {
        packageJson.dependencies[plan.package] = plan.target;
        updated = true;
      }
      if (packageJson.devDependencies?.[plan.package]) {
        packageJson.devDependencies[plan.package] = plan.target;
        updated = true;
      }
    }
  }
  
  if (updated) {
    await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    console.log(`✅ Updated ${plans.length} packages`);
  }
}

async function createUpdatePlan(pkg: string, currentVersion: string): Promise<UpdatePlan | null> {
  try {
    const versions = await fetchPackageVersions(pkg);
    const latest = versions[0];
    
    if (!latest || latest === currentVersion.replace(/[\^~]/, '')) {
      return null;
    }
    
    const current = parseVersion(currentVersion);
    const target = parseVersion(latest);
    
    const type = getUpdateType(current, target);
    const breaking = type === 'major';
    const safe = type === 'patch' || (type === 'minor' && !breaking);
    
    return {
      package: pkg,
      current: currentVersion,
      target: latest,
      type,
      breaking,
      safe
    };
  } catch {
    return null;
  }
}

function parseVersion(version: string): [number, number, number] {
  const clean = version.replace(/[\^~]/, '');
  const parts = clean.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function getUpdateType(current: [number, number, number], target: [number, number, number]): 'patch' | 'minor' | 'major' {
  if (target[0] > current[0]) return 'major';
  if (target[1] > current[1]) return 'minor';
  return 'patch';
}