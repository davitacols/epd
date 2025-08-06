import { execSync } from 'child_process';
import { Cache } from './cache.js';

export async function getPackageVersions(packageName: string): Promise<string[]> {
  const cacheKey = `versions-${packageName}`;
  const cached = await Cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = execSync(`npm view ${packageName} versions --json`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const versions = JSON.parse(result);
    const versionList = Array.isArray(versions) ? versions : [versions];
    
    await Cache.set(cacheKey, versionList, 1800000); // 30min cache
    return versionList;
  } catch (error) {
    return [];
  }
}

export async function getLatestVersion(packageName: string): Promise<string | null> {
  const cacheKey = `latest-${packageName}`;
  const cached = await Cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = execSync(`npm view ${packageName} version`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    
    await Cache.set(cacheKey, result, 1800000);
    return result;
  } catch (error) {
    return null;
  }
}