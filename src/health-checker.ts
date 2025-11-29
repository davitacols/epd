import { PackageJson } from './types.js';

export interface HealthScore {
  package: string;
  score: number;
  factors: {
    maintenance: number;
    security: number;
    popularity: number;
    compatibility: number;
  };
  recommendations: string[];
}

export async function calculateHealthScore(packageJson: PackageJson): Promise<HealthScore[]> {
  const scores: HealthScore[] = [];
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  for (const [pkg, version] of Object.entries(deps)) {
    const health = await analyzePackageHealth(pkg, version);
    scores.push(health);
  }
  
  return scores.sort((a, b) => a.score - b.score);
}

async function analyzePackageHealth(pkg: string, version: string): Promise<HealthScore> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${pkg}`);
    const data = await response.json();
    
    const factors = {
      maintenance: calculateMaintenance(data),
      security: 0.8, // Placeholder - would integrate with security APIs
      popularity: calculatePopularity(data),
      compatibility: 0.9 // Placeholder - would check compatibility
    };
    
    const score = Object.values(factors).reduce((sum, val) => sum + val, 0) / 4;
    
    return {
      package: pkg,
      score,
      factors,
      recommendations: generateRecommendations(factors, pkg)
    };
  } catch {
    return {
      package: pkg,
      score: 0.5,
      factors: { maintenance: 0.5, security: 0.5, popularity: 0.5, compatibility: 0.5 },
      recommendations: ['Unable to analyze - consider reviewing manually']
    };
  }
}

function calculateMaintenance(data: any): number {
  const lastUpdate = new Date(data.time?.modified || 0);
  const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - daysSince / 365);
}

function calculatePopularity(data: any): number {
  const downloads = data.downloads?.weekly || 0;
  return Math.min(1, downloads / 100000);
}

function generateRecommendations(factors: HealthScore['factors'], pkg: string): string[] {
  const recs: string[] = [];
  if (factors.maintenance < 0.5) recs.push('Consider finding actively maintained alternative');
  if (factors.security < 0.7) recs.push('Review security vulnerabilities');
  if (factors.popularity < 0.3) recs.push('Low adoption - verify necessity');
  return recs;
}