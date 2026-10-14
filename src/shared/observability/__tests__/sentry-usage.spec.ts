import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * GoGo-MobileApp#336 — the redaction boundary in `sentry.ts` holds only while
 * nothing else feeds Sentry (ADR-0011 D-10). A new import of the SDK, or a new
 * call that attaches data (`setContext`, `setExtra`, `setTag`,
 * `addBreadcrumb`, `captureMessage`, …), has to come through a review of that
 * boundary; this test is what makes it fail. Same shape as GoGo-BE's
 * `sentry-usage.spec.ts`.
 */

const ROOT = path.resolve(__dirname, '../../../..')
const BOUNDARY = 'src/shared/observability/sentry.ts'

/** Every SDK call `sentry.ts` makes, in the shape it makes it. */
const ALLOWED_CALLS: RegExp[] = [
  /Sentry\.init\(\{\n\s+dsn,\n\s+environment: options\.environment,\n\s+sendDefaultPii: false,/,
  /Sentry\.captureException\(error, \{ tags: \{ kind: context\.kind \} \}\)/,
  /Sentry\.setUser\(id \? \{ id \} : null\)/,
  /Sentry\.wrap\(component as ComponentType<Record<string, unknown>>\)/,
  /guardScope\(Sentry\.getGlobalScope\(\)\)/,
  /guardScope\(Sentry\.getIsolationScope\(\)\)/,
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (['node_modules', '__tests__', '__fixtures__'].includes(name)) return []
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx|js|mjs|cjs)$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name) ? [full] : []
  })
}

describe('Sentry is used only through the #336 boundary', () => {
  const files = [
    ...sourceFiles(path.join(ROOT, 'src')),
    ...sourceFiles(path.join(ROOT, 'modules')),
    ...sourceFiles(path.join(ROOT, 'plugins')),
    path.join(ROOT, 'index.ts'),
    path.join(ROOT, 'app.config.ts'),
  ]

  it('imports the SDK only in sentry.ts', () => {
    const importers = files
      .filter(file => /from ['"]@sentry\/|require\(['"]@sentry\/|import ['"]@sentry\//.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(ROOT, file))
    expect(importers).toEqual([BOUNDARY])
  })

  it('makes only the allowed calls, in the allowed shape', () => {
    const text = readFileSync(path.join(ROOT, BOUNDARY), 'utf8')
    const calls = [...text.matchAll(/Sentry\.(\w+)\(/g)].map(match => match[0])
    expect(calls).toHaveLength(ALLOWED_CALLS.length)
    for (const shape of ALLOWED_CALLS) expect(text).toMatch(shape)
  })

  it('adds no Expo config plugin and no Metro wrapper (ADR-0011 D-5: no uploads)', () => {
    const config = readFileSync(path.join(ROOT, 'app.config.ts'), 'utf8')
    expect(config).not.toMatch(/@sentry\/react-native\/expo/)
    for (const name of ['metro.config.js', 'metro.config.ts']) {
      const file = path.join(ROOT, name)
      try {
        expect(readFileSync(file, 'utf8')).not.toMatch(/@sentry/)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
  })
})
