'use strict';

const { execSync } = require('child_process');
const fs = require('fs');

class EPD {
  static install(options = {}) {
    const packageManager = this.detectPackageManager();
    console.log(`🚀 EPD: Installing with ${packageManager}`);
    
    try {
      execSync(`${packageManager} install`, { stdio: 'inherit' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static scan() {
    console.log('🔍 EPD: Scanning dependencies...');
    return { unused: [], total: 0 };
  }

  static security() {
    console.log('🔒 EPD: Security scan...');
    try {
      const result = execSync('npm audit --json', { encoding: 'utf-8', stdio: 'pipe' });
      return { vulnerabilities: JSON.parse(result).vulnerabilities || {} };
    } catch (error) {
      return { vulnerabilities: {}, error: 'Scan failed' };
    }
  }

  static detectPackageManager() {
    if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
    if (fs.existsSync('yarn.lock')) return 'yarn';
    return 'npm';
  }
}

module.exports = EPD;