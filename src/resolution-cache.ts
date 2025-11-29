import fs from 'fs/promises';
import path from 'path';

interface CachedResolution {
  package: string;
  version: string;
  timestamp: number;
}

const CACHE_FILE = '.epd-cache.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedResolution(pkg: string): Promise<string | null> {
  try {
    const cache = await loadCache();
    const cached = cache[pkg];
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.version;
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function setCachedResolution(pkg: string, version: string): Promise<void> {
  try {
    const cache = await loadCache();
    cache[pkg] = { package: pkg, version, timestamp: Date.now() };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

async function loadCache(): Promise<Record<string, CachedResolution>> {
  try {
    const content = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}