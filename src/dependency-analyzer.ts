import fs from 'fs/promises';
import path from 'path';
import { PackageJson } from './types.js';

export interface DependencyWhy {
  package: string;
  requiredBy: string[];
  type: 'direct' | 'transitive';
  depth: number;
}

export interface BundleImpact {
  package: string;
  sizeMB: number;
  gzippedMB: number;
  dependencies: number;
}

export async function whyDependency(packageName: string): Promise<DependencyWhy> {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
  const requiredBy: string[] = [];
  let type: 'direct' | 'transitive' = 'transitive';
  
  // Check if directly required
  if (packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]) {
    type = 'direct';
    requiredBy.push('package.json');
  }
  
  // Find transitive dependencies (simplified)
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const dep of Object.keys(allDeps)) {
    if (await isDependentOn(dep, packageName)) {
      requiredBy.push(dep);
    }
  }
  
  return {
    package: packageName,
    requiredBy,
    type,
    depth: type === 'direct' ? 1 : 2
  };
}

export async function analyzeBundleImpact(packageName: string): Promise<BundleImpact> {
  try {
    const response = await fetch(`https://bundlephobia.com/api/size?package=${packageName}`);
    const data = await response.json();
    
    return {
      package: packageName,
      sizeMB: (data.size || 0) / (1024 * 1024),
      gzippedMB: (data.gzip || 0) / (1024 * 1024),
      dependencies: data.dependencyCount || 0
    };
  } catch {
    return {
      package: packageName,
      sizeMB: 0,
      gzippedMB: 0,
      dependencies: 0
    };
  }
}

export async function generateDependencyTree(conflictsOnly = false): Promise<Record<string, string[]>> {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
  const tree: Record<string, string[]> = {};
  
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  for (const [name, version] of Object.entries(deps)) {
    const subDeps = await getPackageDependencies(name);
    if (!conflictsOnly || hasVersionConflicts(subDeps)) {
      tree[name] = subDeps;
    }
  }
  
  return tree;
}

async function isDependentOn(parentPkg: string, targetPkg: string): Promise<boolean> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${parentPkg}`);
    const data = await response.json();
    const latestVersion = data['dist-tags']?.latest;
    const deps = data.versions?.[latestVersion]?.dependencies || {};
    return targetPkg in deps;
  } catch {
    return false;
  }
}

async function getPackageDependencies(packageName: string): Promise<string[]> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json();
    const latestVersion = data['dist-tags']?.latest;
    const deps = data.versions?.[latestVersion]?.dependencies || {};
    return Object.keys(deps);
  } catch {
    return [];
  }
}

function hasVersionConflicts(dependencies: string[]): boolean {
  // Simplified conflict detection
  return dependencies.length > 5; // Arbitrary threshold for demo
}