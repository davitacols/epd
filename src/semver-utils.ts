export function parseVersion(version: string): [number, number, number] {
  const clean = version.replace(/[^\d\.]/g, '');
  const parts = clean.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function satisfiesRange(version: string, range: string): boolean {
  if (range.includes('||')) {
    return range.split('||').some(r => satisfiesRange(version, r.trim()));
  }
  
  const [vMajor, vMinor, vPatch] = parseVersion(version);
  const [rMajor, rMinor, rPatch] = parseVersion(range);
  
  if (range.startsWith('^')) {
    return vMajor === rMajor && (vMinor > rMinor || (vMinor === rMinor && vPatch >= rPatch));
  }
  
  if (range.startsWith('~')) {
    return vMajor === rMajor && vMinor === rMinor && vPatch >= rPatch;
  }
  
  if (range.startsWith('>=')) {
    return vMajor > rMajor || (vMajor === rMajor && vMinor > rMinor) || 
           (vMajor === rMajor && vMinor === rMinor && vPatch >= rPatch);
  }
  
  return vMajor === rMajor;
}

export function findBestVersion(versions: string[], requirements: string[]): string | null {
  const stableVersions = versions.filter(v => 
    !v.includes('alpha') && !v.includes('beta') && !v.includes('rc') && 
    !v.includes('canary') && !v.includes('experimental') && !v.includes('next')
  );
  
  const candidates = stableVersions.length > 0 ? stableVersions : versions;
  
  for (const version of candidates) {
    if (requirements.every(req => satisfiesRange(version, req))) {
      return version;
    }
  }
  
  return candidates[0] || null;
}