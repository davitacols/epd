import { fetchPackageVersions } from './registry.js';

export interface SmartResolution {
  package: string;
  resolvedVersion: string;
  strategy: 'popularity' | 'stability' | 'compatibility';
  confidence: number;
}

export async function smartResolve(conflicts: Record<string, string[]>, strategy: 'smart' | 'stable' = 'smart'): Promise<SmartResolution[]> {
  const resolutions: SmartResolution[] = [];
  
  for (const [pkg, versions] of Object.entries(conflicts)) {
    const available = await fetchPackageVersions(pkg);
    let resolved: string;
    let resolutionStrategy: SmartResolution['strategy'];
    
    if (strategy === 'stable') {
      resolved = versions.find(v => !v.includes('beta') && !v.includes('alpha')) || versions[0];
      resolutionStrategy = 'stability';
    } else {
      // Smart: prefer latest stable that satisfies most requirements
      resolved = available.find(v => versions.some(req => satisfiesRange(v, req))) || versions[0];
      resolutionStrategy = 'compatibility';
    }
    
    resolutions.push({
      package: pkg,
      resolvedVersion: resolved,
      strategy: resolutionStrategy,
      confidence: calculateConfidence(versions, resolved)
    });
  }
  
  return resolutions;
}

function satisfiesRange(version: string, range: string): boolean {
  // Simplified semver check
  const cleanVersion = version.replace(/[^\d\.]/g, '');
  const cleanRange = range.replace(/[^\d\.]/g, '');
  return cleanVersion.startsWith(cleanRange.split('.')[0]);
}

function calculateConfidence(versions: string[], resolved: string): number {
  return versions.includes(resolved) ? 0.9 : 0.6;
}