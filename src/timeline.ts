/**
 * Enhanced Peer Dependencies (epd)
 * Copyright (c) 2024 Enhanced Peer Dependencies (epd)
 * Licensed under the MIT License
 */

import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { PackageJson } from './types.js'

interface TimelineEntry {
  timestamp: string
  action: 'install' | 'add' | 'remove' | 'update'
  packages: Record<string, { from?: string; to: string }>
  packageJson: PackageJson
  hash: string
}

interface Timeline {
  entries: TimelineEntry[]
  current: number
}

export class DependencyTimeline {
  private timelinePath: string
  private backupDir: string

  constructor(projectRoot: string = process.cwd()) {
    this.timelinePath = path.join(projectRoot, '.epd', 'timeline.json')
    this.backupDir = path.join(projectRoot, '.epd', 'backups')
  }

  async init(): Promise<void> {
    const epdDir = path.dirname(this.timelinePath)
    if (!existsSync(epdDir)) {
      await fs.mkdir(epdDir, { recursive: true })
    }
    if (!existsSync(this.backupDir)) {
      await fs.mkdir(this.backupDir, { recursive: true })
    }
  }

  async snapshot(action: string, packages: Record<string, { from?: string; to: string }>): Promise<void> {
    await this.init()
    
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
    const hash = this.generateHash(packageJson)
    
    const entry: TimelineEntry = {
      timestamp: new Date().toISOString(),
      action: action as any,
      packages,
      packageJson,
      hash
    }

    // Save backup
    await fs.writeFile(
      path.join(this.backupDir, `${hash}.json`),
      JSON.stringify(packageJson, null, 2)
    )

    // Update timeline
    const timeline = await this.loadTimeline()
    timeline.entries.push(entry)
    timeline.current = timeline.entries.length - 1
    
    await fs.writeFile(this.timelinePath, JSON.stringify(timeline, null, 2))
  }

  async getTimeline(): Promise<Timeline> {
    return this.loadTimeline()
  }

  async rollback(target: string | number): Promise<boolean> {
    const timeline = await this.loadTimeline()
    
    let targetIndex: number
    if (typeof target === 'string') {
      // Date-based rollback
      const targetDate = new Date(target)
      targetIndex = timeline.entries.findIndex(entry => 
        new Date(entry.timestamp) <= targetDate
      )
      if (targetIndex === -1) {
        targetIndex = timeline.entries.findIndex(entry => 
          new Date(entry.timestamp) >= targetDate
        ) - 1
      }
    } else {
      targetIndex = target
    }

    if (targetIndex < 0 || targetIndex >= timeline.entries.length) {
      throw new Error('Invalid rollback target')
    }

    const targetEntry = timeline.entries[targetIndex]
    
    // Restore package.json
    await fs.writeFile('package.json', JSON.stringify(targetEntry.packageJson, null, 2))
    
    // Update timeline current pointer
    timeline.current = targetIndex
    await fs.writeFile(this.timelinePath, JSON.stringify(timeline, null, 2))
    
    return true
  }

  async showHistory(limit: number = 10): Promise<void> {
    const timeline = await this.loadTimeline()
    const entries = timeline.entries.slice(-limit).reverse()
    
    console.log('📅 Dependency Timeline:\n')
    
    entries.forEach((entry, index) => {
      const isCurrent = timeline.current === timeline.entries.length - 1 - index
      const marker = isCurrent ? '→' : ' '
      const date = new Date(entry.timestamp).toLocaleString()
      
      console.log(`${marker} ${date} - ${entry.action}`)
      
      Object.entries(entry.packages).forEach(([pkg, change]) => {
        if (change.from) {
          console.log(`    ${pkg}: ${change.from} → ${change.to}`)
        } else {
          console.log(`    ${pkg}: ${change.to} (new)`)
        }
      })
      console.log()
    })
  }

  private async loadTimeline(): Promise<Timeline> {
    if (!existsSync(this.timelinePath)) {
      return { entries: [], current: -1 }
    }
    
    try {
      const content = await fs.readFile(this.timelinePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return { entries: [], current: -1 }
    }
  }

  private generateHash(packageJson: PackageJson): string {
    const deps = JSON.stringify({
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {}
    })
    return Buffer.from(deps).toString('base64').slice(0, 8)
  }
}

export async function createSnapshot(action: string, packages: Record<string, { from?: string; to: string }>): Promise<void> {
  const timeline = new DependencyTimeline()
  await timeline.snapshot(action, packages)
}

export async function showTimeline(limit?: number): Promise<void> {
  const timeline = new DependencyTimeline()
  await timeline.showHistory(limit)
}

export async function rollbackTo(target: string | number): Promise<void> {
  const timeline = new DependencyTimeline()
  const success = await timeline.rollback(target)
  if (success) {
    console.log(`✅ Rolled back to ${typeof target === 'string' ? target : `entry #${target}`}`)
  }
}