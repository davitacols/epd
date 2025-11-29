import { PackageJson } from './types.js';

export interface LicenseInfo {
  package: string;
  license: string;
  compatible: boolean;
  risk: 'low' | 'medium' | 'high';
}

export interface LicenseReport {
  compatible: LicenseInfo[];
  incompatible: LicenseInfo[];
  unknown: LicenseInfo[];
  summary: { total: number; compatible: number; risks: number };
}

const COMPATIBLE_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense'
]);

const HIGH_RISK_LICENSES = new Set([
  'GPL-3.0', 'AGPL-3.0', 'LGPL-3.0'
]);

export async function checkLicenses(packageJson: PackageJson): Promise<LicenseReport> {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const licenses: LicenseInfo[] = [];
  
  for (const [pkg, version] of Object.entries(deps)) {
    const licenseInfo = await getPackageLicense(pkg);
    licenses.push(licenseInfo);
  }
  
  const compatible = licenses.filter(l => l.compatible);
  const incompatible = licenses.filter(l => !l.compatible && l.license !== 'unknown');
  const unknown = licenses.filter(l => l.license === 'unknown');
  
  return {
    compatible,
    incompatible,
    unknown,
    summary: {
      total: licenses.length,
      compatible: compatible.length,
      risks: incompatible.filter(l => l.risk === 'high').length
    }
  };
}

async function getPackageLicense(packageName: string): Promise<LicenseInfo> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json();
    const latestVersion = data['dist-tags']?.latest;
    const license = data.versions?.[latestVersion]?.license || 'unknown';
    
    return {
      package: packageName,
      license,
      compatible: COMPATIBLE_LICENSES.has(license),
      risk: HIGH_RISK_LICENSES.has(license) ? 'high' : 
            COMPATIBLE_LICENSES.has(license) ? 'low' : 'medium'
    };
  } catch {
    return {
      package: packageName,
      license: 'unknown',
      compatible: false,
      risk: 'medium'
    };
  }
}

export function generateLicenseReport(report: LicenseReport): void {
  console.log(`\n📄 License Compliance Report:`);
  console.log(`   Total packages: ${report.summary.total}`);
  console.log(`   Compatible: ${report.summary.compatible}`);
  console.log(`   High risk: ${report.summary.risks}`);
  
  if (report.incompatible.length > 0) {
    console.log(`\n⚠️ Incompatible licenses:`);
    report.incompatible.forEach(pkg => {
      const icon = pkg.risk === 'high' ? '🚨' : '⚠️';
      console.log(`   ${icon} ${pkg.package}: ${pkg.license}`);
    });
  }
  
  if (report.unknown.length > 0) {
    console.log(`\n❓ Unknown licenses:`);
    report.unknown.forEach(pkg => {
      console.log(`   - ${pkg.package}`);
    });
  }
}