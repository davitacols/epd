import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.epd', 'cache');

export class Cache {
  private static ensureCacheDir() {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  static async get(key: string): Promise<any> {
    try {
      this.ensureCacheDir();
      const data = await readFile(join(CACHE_DIR, `${key}.json`), 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.expires > Date.now()) {
        return parsed.data;
      }
    } catch (e) {}
    return null;
  }

  static async set(key: string, data: any, ttl = 3600000): Promise<void> {
    try {
      this.ensureCacheDir();
      await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify({
        data,
        expires: Date.now() + ttl
      }));
    } catch (e) {}
  }
}