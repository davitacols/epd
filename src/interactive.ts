import { createInterface } from 'readline';
import { PackageJson } from './types.js';

export interface ConflictChoice {
  package: string;
  versions: string[];
  selectedVersion?: string;
  strategy: 'auto' | 'manual' | 'skip';
}

export async function promptConflictResolution(conflicts: ConflictChoice[]): Promise<ConflictChoice[]> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const results: ConflictChoice[] = [];

  for (const conflict of conflicts) {
    console.log(`\n🔄 Conflict detected for ${conflict.package}`);
    console.log(`Available versions: ${conflict.versions.join(', ')}`);
    
    const choice = await new Promise<string>((resolve) => {
      rl.question('Choose: (a)uto-resolve, (m)anual select, (s)kip: ', resolve);
    });

    switch (choice.toLowerCase()) {
      case 'a':
        results.push({ ...conflict, strategy: 'auto' });
        break;
      case 'm':
        const version = await new Promise<string>((resolve) => {
          rl.question(`Select version (${conflict.versions.join('|')}): `, resolve);
        });
        results.push({ ...conflict, strategy: 'manual', selectedVersion: version });
        break;
      default:
        results.push({ ...conflict, strategy: 'skip' });
    }
  }

  rl.close();
  return results;
}