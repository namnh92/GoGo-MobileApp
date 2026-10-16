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
  // #341: a JS event carries the screen read at capture, admitted in this file.
  /Sentry\.captureException\(error, \{ tags: \{ kind: context\.kind, \.\.\.screenTag\(\) \} \}\)/,
  /Sentry\.setUser\(appUserId \? \{ id: appUserId \} : null\)/,
  /Sentry\.wrap\(component as ComponentType<Record<string, unknown>>\)/,
  /guardScope\(Sentry\.getGlobalScope\(\)\)/,
  /guardScope\(Sentry\.getIsolationScope\(\)\)/,
  // #341: the screen tag, a route template, admitted and written through the guarded scope.
  /Sentry\.getIsolationScope\(\)\.setTag\('screen', admitScreen\(template\)\)/,
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

  // The one other importer is the build-time config plugin wrapper (#340): it
  // runs at prebuild, is never bundled, and loads nothing but Sentry's Expo plugin.
  it('imports the SDK only in sentry.ts', () => {
    const importers = files
      .filter(file => /from ['"]@sentry\/|require\(['"]@sentry\/|import ['"]@sentry\//.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(ROOT, file))
      .sort()
    expect(importers).toEqual(['plugins/with-sentry-uploads.js', BOUNDARY])
    const wrapper = readFileSync(path.join(ROOT, 'plugins/with-sentry-uploads.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect([...wrapper.matchAll(/['"](@sentry\/[^'"]+)['"]/g)].map(match => match[1])).toEqual(['@sentry/react-native/expo'])
  })

  it('makes only the allowed calls, in the allowed shape', () => {
    const text = readFileSync(path.join(ROOT, BOUNDARY), 'utf8')
    const calls = [...text.matchAll(/Sentry\.(\w+)\(/g)].map(match => match[0])
    expect(calls).toHaveLength(ALLOWED_CALLS.length)
    for (const shape of ALLOWED_CALLS) expect(text).toMatch(shape)
  })

  // #341: the tag is fed from the root layout, once, inside the providers and
  // before the navigator — the one place that sees every route.
  it('mounts the screen tag once in the root layout', () => {
    const layout = readFileSync(path.join(ROOT, 'src/app/_layout.tsx'), 'utf8')
    expect(layout.match(/<SentryScreenTag \/>/g)).toHaveLength(1)
    expect(layout.indexOf('<SentryScreenTag />')).toBeGreaterThan(layout.indexOf('<AppProviders>'))
    expect(layout.indexOf('<SentryScreenTag />')).toBeLessThan(layout.indexOf('<Stack'))
  })

  // GoGo-MobileApp#340 replaced phase 1's "no plugin, no Metro wrapper"
  // (ADR 0010, ADR-0011 D-5 phase 2). What still has to hold: neither carries a
  // credential, and neither changes what the app sends.
  it('the config plugin is registered through the wrapper and carries no credential or upload switch', () => {
    const config = readFileSync(path.join(ROOT, 'app.config.ts'), 'utf8').replace(/\/\/.*$/gm, '')
    expect(config).toContain("'./plugins/with-sentry-uploads.js'")
    expect(config).not.toMatch(/@sentry\/react-native\/expo|authToken|SENTRY_AUTH_TOKEN|disableAutoUpload/)
    // Code only: the header comment explains why these are absent.
    const wrapper = readFileSync(path.join(ROOT, 'plugins/with-sentry-uploads.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(wrapper).toContain("require('@sentry/react-native/expo')")
    expect(wrapper).not.toMatch(/authToken|SENTRY_AUTH_TOKEN|disableAutoUpload/)
  })

  it('Metro adds the Sentry serializer with every optional behaviour off', () => {
    const metro = readFileSync(path.join(ROOT, 'metro.config.js'), 'utf8')
    const code = metro.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    expect(code).toBe(
      [
        "const { getSentryExpoConfig } = require('@sentry/react-native/metro')",
        '',
        'module.exports = getSentryExpoConfig(__dirname, {',
        '  enableSourceContextInDevelopment: false,',
        '  optionsFile: false,',
        '  injectReleaseForWeb: false,',
        '  annotateReactComponents: false,',
        '  autoWrapExpoRouterErrorBoundary: false,',
        '  includeWebReplay: false,',
        '  includeWebFeedback: false,',
        '})',
      ].join('\n'),
    )
  })
})
