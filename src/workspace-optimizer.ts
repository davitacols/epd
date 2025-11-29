import fs from 'fs/promises';
import path from 'path';
import { PackageJson } from './types.js';

export interface OptimizationResult {
  hoisted: string[];
  deduped: string[];
  savings: { packages: number; sizeMB: number };
}

export async function optimizeWorkspace(strategy: 'hoist' | 'dedupe' = 'hoist'): Promise<OptimizationResult> {
  const workspaces = await findWorkspaces();
  
  if (strategy === 'hoist') {
    return hoistDependencies(workspaces);
  } else {
    return dedupeDependencies(workspaces);
  }
}

async function findWorkspaces(): Promise<Array<{path: string, packageJson: PackageJson}>> {
  const workspaces = [];
  const rootPkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
  
  if (rootPkg.workspaces) {
    const patterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages;
    
    for (const pattern of patterns) {
      const wsPath = pattern.replace('/*', '');
      try {
        const wsPkg = JSON.parse(await fs.readFile(path.join(wsPath, 'package.json'), 'utf-8'));
        workspaces.push({ path: wsPath, packageJson: wsPkg });
      } catch {}
    }
  }
  
  return workspaces;
}

async function hoistDependencies(workspaces: Array<{path: string, packageJson: PackageJson}>): Promise<OptimizationResult> {
  const commonDeps: Record<string, Set<string>> = {};
  const hoisted: string[] = [];
  
  // Find common dependencies
  workspaces.forEach(ws => {
    const deps = ws.packageJson.dependencies || {};
    Object.entries(deps).forEach(([name, version]) => {
      if (!commonDeps[name]) commonDeps[name] = new Set();
      commonDeps[name].add(version);
    });
  });
  
  // Hoist dependencies used by multiple workspaces with same version
  for (const [name, versions] of Object.entries(commonDeps)) {
    if (versions.size === 1 && workspaces.filter(ws => ws.packageJson.dependencies?.[name]).length > 1) {
      hoisted.push(name);
    }
  }
  
  return {
    hoisted,
    deduped: [],
    savings: { packages: hoisted.length, sizeMB: hoisted.length * 0.5 }
  };
}

async function dedupeDependencies(workspaces: Array<{path: string, packageJson: PackageJson}>): Promise<OptimizationResult> {
  const duplicates: Record<string, string[]> = {};
  const deduped: string[] = [];
  
  workspaces.forEach(ws => {
    const deps = ws.packageJson.dependencies || {};
    Object.entries(deps).forEach(([name, version]) => {
      if (!duplicates[name]) duplicates[name] = [];
      if (!duplicates[name].includes(version)) {
        duplicates[name].push(version);
      }
    });
  });
  
  // Find packages with multiple versions
  Object.entries(duplicates).forEach(([name, versions]) => {
    if (versions.length > 1) {
      deduped.push(name);
    }
  });
  
  return {
    hoisted: [],
    deduped,
    savings: { packages: deduped.length, sizeMB: deduped.length * 0.3 }
  };
}