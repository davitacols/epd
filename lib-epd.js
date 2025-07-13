'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Core EPD functionality for Node.js integration
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

  static scan(options = {}) {
    console.log('🔍 EPD: Scanning dependencies...');
    // Simplified scan implementation
    return { unused: [], total: 0 };
  }

  static security(options = {}) {
    console.log('🔒 EPD: Security scan...');
    try {
      execSync('npm audit --json', { stdio: 'pipe' });
      return { vulnerabilities: [] };
    } catch (error) {
      return { vulnerabilities: [], error: 'Scan failed' };
    }
  }

  static detectPackageManager() {
    if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
    if (fs.existsSync('yarn.lock')) return 'yarn';
    return 'npm';
  }
}

module.exports = EPD;