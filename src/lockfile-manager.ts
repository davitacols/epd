import fs from 'fs/promises';
import { existsSync } from 'fs';

export async function preserveLockfile(): Promise<void> {
  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  
  for (const lockfile of lockfiles) {
    if (existsSync(lockfile)) {
      await fs.copyFile(lockfile, `${lockfile}.epd-backup`);
      break;
    }
  }
}

export async function restoreLockfile(): Promise<void> {
  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  
  for (const lockfile of lockfiles) {
    const backup = `${lockfile}.epd-backup`;
    if (existsSync(backup)) {
      await fs.copyFile(backup, lockfile);
      await fs.unlink(backup);
      break;
    }
  }
}