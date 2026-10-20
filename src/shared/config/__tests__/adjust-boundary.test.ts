import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * GoGo-MobileApp#367 (AC-A3, shape D1, rev 2 D5.4) — the Adjust boundary,
 * read from the source rather than asserted by a fake: one importer, no
 * events in phase 1, and the SDK never asks for ATT or reads the IDFA on
 * GoGo's behalf.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

const files = sourceFiles('src').map(path => ({ path, text: readFileSync(path, 'utf8') }))

describe('Adjust boundary', () => {
  it('only the acquisition bootstrap imports the SDK', () => {
    expect(files.filter(f => f.text.includes("from 'react-native-adjust'")).map(f => f.path)).toEqual([
      'src/shared/acquisition/bootstrap.ts',
    ])
  })

  it('phase 1 sends no events and never asks for tracking through the SDK', () => {
    for (const call of ['trackEvent', 'AdjustEvent', 'requestAppTrackingAuthorization', 'disableAppTrackingTransparencyUsage', 'disableIdfaReading']) {
      expect(files.filter(f => f.text.includes(call)).map(f => f.path), call).toEqual([])
    }
  })
})
