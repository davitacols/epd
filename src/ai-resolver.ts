/**
 * Enhanced Peer Dependencies (epd)
 * Copyright (c) 2024 Enhanced Peer Dependencies (epd)
 * Licensed under the MIT License
 */

import { PackageInfo, ConflictResolution } from './types.js'

interface AIResolutionRequest {
  conflicts: ConflictInfo[]
  projectContext: ProjectContext
  preferences?: ResolutionPreferences
}

interface ConflictInfo {
  package: string
  requiredVersions: string[]
  requiredBy: string[]
  currentVersion?: string
}

interface ProjectContext {
  packageManager: string
  isMonorepo: boolean
  framework?: string
  dependencies: Record<string, string>
}

interface ResolutionPreferences {
  preferStable: boolean
  preferLatest?: boolean
  riskTolerance: 'low' | 'medium' | 'high'
}

interface AIResolution {
  package: string
  recommendedVersion: string
  confidence: number
  reasoning: string
  alternatives: Array<{
    version: string
    pros: string[]
    cons: string[]
  }>
}

export class AIResolver {
  private apiKey?: string
  private endpoint: string = 'https://api.openai.com/v1/chat/completions'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.EPD_AI_API_KEY
  }

  async resolveConflicts(request: AIResolutionRequest): Promise<AIResolution[]> {
    if (!this.apiKey) {
      return this.fallbackResolution(request)
    }

    try {
      const prompt = this.buildPrompt(request)
      const response = await this.callAI(prompt)
      return this.parseAIResponse(response, request.conflicts)
    } catch (error: any) {
      console.warn('⚠️ AI resolution failed, using fallback:', error?.message || error)
      return this.fallbackResolution(request)
    }
  }

  private buildPrompt(request: AIResolutionRequest): string {
    const { conflicts, projectContext, preferences } = request
    
    return `You are an expert JavaScript dependency resolver. Analyze these peer dependency conflicts and provide optimal resolutions.

PROJECT CONTEXT:
- Package Manager: ${projectContext.packageManager}
- Monorepo: ${projectContext.isMonorepo}
- Framework: ${projectContext.framework || 'Unknown'}

CONFLICTS:
${conflicts.map(c => `
Package: ${c.package}
Required Versions: ${c.requiredVersions.join(', ')}
Required By: ${c.requiredBy.join(', ')}
Current: ${c.currentVersion || 'Not installed'}
`).join('\n')}

PREFERENCES:
- Prefer Stable: ${preferences?.preferStable ?? true}
- Risk Tolerance: ${preferences?.riskTolerance ?? 'medium'}

Provide JSON response with this structure:
{
  "resolutions": [
    {
      "package": "package-name",
      "recommendedVersion": "1.2.3",
      "confidence": 0.95,
      "reasoning": "Brief explanation",
      "alternatives": [
        {
          "version": "1.2.2",
          "pros": ["Compatible with all requirements"],
          "cons": ["Older version"]
        }
      ]
    }
  ]
}

Focus on compatibility, stability, and minimal breaking changes.`
  }

  private async callAI(prompt: string): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  private parseAIResponse(response: string, conflicts: ConflictInfo[]): AIResolution[] {
    try {
      const parsed = JSON.parse(response)
      return parsed.resolutions || []
    } catch {
      // Fallback if JSON parsing fails
      return this.fallbackResolution({ conflicts } as AIResolutionRequest)
    }
  }

  private fallbackResolution(request: AIResolutionRequest): AIResolution[] {
    return request.conflicts.map(conflict => ({
      package: conflict.package,
      recommendedVersion: this.selectBestVersion(conflict.requiredVersions),
      confidence: 0.7,
      reasoning: 'Selected most compatible version using heuristics',
      alternatives: conflict.requiredVersions.slice(0, 2).map(v => ({
        version: v,
        pros: ['Available option'],
        cons: ['May have compatibility issues']
      }))
    }))
  }

  private selectBestVersion(versions: string[]): string {
    // Simple heuristic: prefer the highest version that satisfies most requirements
    return versions.sort((a, b) => this.compareVersions(b, a))[0]
  }

  private compareVersions(a: string, b: string): number {
    const cleanA = a.replace(/[^0-9.]/g, '')
    const cleanB = b.replace(/[^0-9.]/g, '')
    return cleanA.localeCompare(cleanB, undefined, { numeric: true })
  }
}

export async function resolveWithAI(
  conflicts: ConflictInfo[],
  projectContext: ProjectContext,
  preferences?: ResolutionPreferences
): Promise<AIResolution[]> {
  const resolver = new AIResolver()
  return resolver.resolveConflicts({ conflicts, projectContext, preferences })
}