import { writeFile, readFile } from 'fs/promises';
import { PackageJson } from './types.js';

export async function autoFixPackageJson(issues: string[]): Promise<boolean> {
  try {
    const content = await readFile('package.json', 'utf-8');
    const packageJson: PackageJson = JSON.parse(content);
    let modified = false;

    // Fix duplicate dependencies
    if (issues.includes('duplicates')) {
      const deps = packageJson.dependencies || {};
      const devDeps = packageJson.devDependencies || {};
      
      for (const dep of Object.keys(deps)) {
        if (devDeps[dep]) {
          delete devDeps[dep];
          modified = true;
          console.log(`🔧 Removed duplicate ${dep} from devDependencies`);
        }
      }
    }

    // Sort dependencies alphabetically
    if (issues.includes('sort')) {
      if (packageJson.dependencies) {
        const sorted = Object.keys(packageJson.dependencies)
          .sort()
          .reduce((acc, key) => {
            acc[key] = packageJson.dependencies![key];
            return acc;
          }, {} as Record<string, string>);
        packageJson.dependencies = sorted;
        modified = true;
      }
      
      if (packageJson.devDependencies) {
        const sorted = Object.keys(packageJson.devDependencies)
          .sort()
          .reduce((acc, key) => {
            acc[key] = packageJson.devDependencies![key];
            return acc;
          }, {} as Record<string, string>);
        packageJson.devDependencies = sorted;
        modified = true;
      }
    }

    if (modified) {
      await writeFile('package.json', JSON.stringify(packageJson, null, 2));
      console.log('✅ Auto-fixed package.json');
    }

    return modified;
  } catch (error) {
    console.error('❌ Auto-fix failed:', error);
    return false;
  }
}