export interface RegistryPackageInfo {
  name: string;
  versions: string[];
  latest: string;
  'dist-tags': Record<string, string>;
}

export async function fetchPackageVersions(packageName: string): Promise<string[]> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return Object.keys(data.versions || {}).reverse();
  } catch (error) {
    console.warn(`⚠️ Could not fetch versions for ${packageName}:`, error);
    return [];
  }
}

export async function getLatestVersion(packageName: string): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.version || null;
  } catch {
    return null;
  }
}