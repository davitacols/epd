import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface AnalyticsEvent {
  event: string;
  timestamp: number;
  version: string;
  platform: string;
  nodeVersion: string;
  packageManager?: string;
  conflictsResolved?: number;
  duration?: number;
  command?: string;
}

class Analytics {
  private configPath: string;
  private enabled: boolean;

  constructor() {
    this.configPath = join(homedir(), '.epd', 'analytics.json');
    this.enabled = this.getConsentStatus();
  }

  private getConsentStatus(): boolean {
    try {
      if (existsSync(this.configPath)) {
        const config = JSON.parse(readFileSync(this.configPath, 'utf8'));
        return config.enabled !== false;
      }
      return true; // Default to enabled
    } catch {
      return true;
    }
  }

  track(event: string, data: Partial<AnalyticsEvent> = {}) {
    if (!this.enabled) return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      timestamp: Date.now(),
      version: this.getVersion(),
      platform: process.platform,
      nodeVersion: process.version,
      ...data
    };

    // Store locally for now - can be sent to analytics service later
    this.storeEvent(analyticsEvent);
  }

  private storeEvent(event: AnalyticsEvent) {
    try {
      const dir = join(homedir(), '.epd');
      if (!existsSync(dir)) {
        execSync(`mkdir "${dir}"`, { stdio: 'ignore' });
      }

      const eventsFile = join(dir, 'events.jsonl');
      writeFileSync(eventsFile, JSON.stringify(event) + '\n', { flag: 'a' });
    } catch {
      // Fail silently
    }
  }

  private getVersion(): string {
    try {
      const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
      return packageJson.version;
    } catch {
      return '0.0.0';
    }
  }

  disable() {
    this.enabled = false;
    this.saveConfig({ enabled: false });
  }

  private saveConfig(config: any) {
    try {
      const dir = join(homedir(), '.epd');
      if (!existsSync(dir)) {
        execSync(`mkdir "${dir}"`, { stdio: 'ignore' });
      }
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch {
      // Fail silently
    }
  }
}

export const analytics = new Analytics();