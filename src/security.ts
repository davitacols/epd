import { execSync } from 'child_process';
import { PackageJson } from './types.js';

export interface SecurityIssue {
  package: string;
  version: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  url?: string;
}

export async function scanSecurity(packageJson: PackageJson): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  try {
    // Use npm audit for security scanning
    const auditResult = execSync('npm audit --json', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    
    const audit = JSON.parse(auditResult);
    
    if (audit.vulnerabilities) {
      for (const [pkg, vuln] of Object.entries(audit.vulnerabilities as any)) {
        const vulnerability = vuln as any;
        issues.push({
          package: pkg,
          version: vulnerability.via?.[0]?.range || 'unknown',
          severity: vulnerability.severity || 'moderate',
          title: vulnerability.via?.[0]?.title || 'Security vulnerability',
          url: vulnerability.via?.[0]?.url
        });
      }
    }
  } catch (error: any) {
    if (error.stdout) {
      // npm audit returns exit code 1 when vulnerabilities found, but still provides JSON
      try {
        const audit = JSON.parse(error.stdout);
        if (audit.vulnerabilities) {
          for (const [pkg, vuln] of Object.entries(audit.vulnerabilities as any)) {
            const vulnerability = vuln as any;
            issues.push({
              package: pkg,
              version: vulnerability.via?.[0]?.range || 'unknown',
              severity: vulnerability.severity || 'moderate',
              title: vulnerability.via?.[0]?.title || 'Security vulnerability',
              url: vulnerability.via?.[0]?.url
            });
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Security scan failed:', error);
      }
    } else {
      console.warn('⚠️ Security scan failed:', error);
    }
  }
  
  return issues;
}

export function generateSecurityReport(issues: SecurityIssue[]): void {
  if (issues.length === 0) {
    console.log('✅ No security vulnerabilities found');
    return;
  }

  console.log(`\n🔒 Security Report (${issues.length} issues found):`);
  
  const grouped = issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(grouped).forEach(([severity, count]) => {
    const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📋';
    console.log(`${icon} ${severity}: ${count}`);
  });
}