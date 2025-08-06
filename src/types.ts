export interface PackageInfo {
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency' | 'optionalDependency';
  requiredBy?: string[];
}

export interface ScanOptions {
  directory?: string;
  includeDevDependencies?: boolean;
  includePeerDependencies?: boolean;
  includeOptionalDependencies?: boolean;
  ignoreSpecialDependencies?: boolean;
  verbose?: boolean;
}

export interface ScanResult {
  unused: Record<string, PackageInfo>;
  potentiallyUnused: Record<string, PackageInfo>;
  total: number;
  scannedFiles: number;
}

export interface ScanReport {
  unusedCount: number;
  potentiallyUnusedCount: number;
  totalDependencies: number;
  filesScanned: number;
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  [key: string]: any;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export interface ConflictResolution {
  package: string;
  version: string;
  strategy: 'ai' | 'heuristic' | 'manual';
  confidence?: number;
  reasoning?: string;
}