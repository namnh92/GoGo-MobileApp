import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'

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

const NAVIGATORS = new Set(['Stack', 'Tabs', 'Drawer'])
const SCREEN_TAG_MODULE = '@/shared/observability/screen-tag.view'

/** What `navigatorAudit` found in one file. */
type NavigatorAudit = {
  /** The canonical name (`Stack`, `Tabs`, `Drawer`) of every expo-router navigator the file renders. */
  navigators: string[]
  /** Every way the mount-time write could be skipped or overridden, one line each, in source order. */
  faults: string[]
}

/**
 * SA-341-02 / Sol F-08 (PR #349) — the mount-time write reaches only the
 * screens of a navigator that passes `screenTagLayout`, and React Navigation
 * prefers a per-screen or per-group `layout` / `screenLayout` over the
 * navigator's (`@react-navigation/core` `useDescriptors.tsx`). A grep sees
 * neither an alias nor a spread, so this reads the file's AST instead:
 *
 * - A JSX tag is a navigator when it resolves to expo-router's `Stack`, `Tabs`
 *   or `Drawer` — a named import (renamed or not), a namespace member
 *   (`Router.Tabs`), or a `const` / `let` alias of one of those, through any
 *   number of aliases. Each must carry `screenLayout={screenTagLayout}`, with
 *   `screenTagLayout` imported from `screen-tag.view` — not a local of the
 *   same name.
 * - `withLayoutContext` anywhere is a custom navigator: fails.
 * - A JSX attribute named `layout` anywhere, and a `screenLayout` that is not
 *   `screenTagLayout`, fail: both override the navigator's.
 * - A JSX spread on a navigator or on its `Screen` / `Group` cannot be shown
 *   not to carry one of those: fails.
 * - A navigator or the `expo-router` namespace leaving the file as an export
 *   would let another file render it under a name this audit cannot resolve:
 *   fails.
 *
 * Known limits: `require('expo-router')` and `React.createElement(Tabs, …)`
 * are not read, and a `layout` attribute of any other component — Reanimated's
 * layout animations, say — trips the `layout` rule.
 */
function navigatorAudit(fileName: string, text: string): NavigatorAudit {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
  const navigators: string[] = []
  const faults = new Set<string>()

  /** Local name → canonical navigator, from imports and aliases. */
  const named = new Map<string, string>()
  /** Local names bound to the whole `expo-router` module. */
  const namespaces = new Set<string>()
  let screenTagLayoutImported = false

  const moduleOf = (node: ts.ImportDeclaration | ts.ExportDeclaration) =>
    node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null

  /** The canonical navigator an expression names, or `null`. */
  const navigatorOf = (node: ts.Node): string | null => {
    if (ts.isIdentifier(node)) return named.get(node.text) ?? null
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && namespaces.has(node.expression.text)) {
      return NAVIGATORS.has(node.name.text) ? node.name.text : null
    }
    return null
  }
  /** The canonical navigator a `<X.Screen>` / `<X.Group>` tag belongs to, or `null`. */
  const screenOf = (node: ts.Node): string | null =>
    ts.isPropertyAccessExpression(node) && (node.name.text === 'Screen' || node.name.text === 'Group') ? navigatorOf(node.expression) : null

  // Bindings first: imports, then aliases until no new one appears, so an
  // alias of an alias resolves whatever order the file declares them in.
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings) continue
    const bindings = statement.importClause.namedBindings
    if (moduleOf(statement) === 'expo-router') {
      if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
      else for (const spec of bindings.elements) {
        const imported = (spec.propertyName ?? spec.name).text
        if (NAVIGATORS.has(imported)) named.set(spec.name.text, imported)
      }
    } else if (moduleOf(statement) === SCREEN_TAG_MODULE && ts.isNamedImports(bindings)) {
      if (bindings.elements.some(spec => spec.name.text === 'screenTagLayout' && !spec.propertyName)) screenTagLayoutImported = true
    }
  }
  const bind = (map: Map<string, string> | Set<string>, name: string, value: string): boolean => {
    if (map.has(name)) return false
    if (map instanceof Map) map.set(name, value)
    else map.add(name)
    return true
  }
  const aliases = (node: ts.Node): boolean => {
    let changed = false
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = node.initializer
      if (ts.isIdentifier(node.name)) {
        const navigator = navigatorOf(init)
        if (navigator) changed = bind(named, node.name.text, navigator) || changed
        if (ts.isIdentifier(init) && namespaces.has(init.text)) changed = bind(namespaces, node.name.text, init.text) || changed
      } else if (ts.isObjectBindingPattern(node.name) && ts.isIdentifier(init) && namespaces.has(init.text)) {
        // `const { Tabs: T } = Router`
        for (const element of node.name.elements) {
          const imported = (element.propertyName ?? element.name).getText(source)
          if (NAVIGATORS.has(imported) && ts.isIdentifier(element.name)) changed = bind(named, element.name.text, imported) || changed
        }
      }
    }
    ts.forEachChild(node, child => {
      changed = aliases(child) || changed
    })
    return changed
  }
  while (aliases(source)) {
    // until no new alias appears
  }

  const isScreenTagLayout = (attr: ts.JsxAttribute) =>
    attr.initializer !== undefined &&
    ts.isJsxExpression(attr.initializer) &&
    attr.initializer.expression !== undefined &&
    ts.isIdentifier(attr.initializer.expression) &&
    attr.initializer.expression.text === 'screenTagLayout'

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === 'withLayoutContext') faults.add('withLayoutContext')
    if (ts.isExportDeclaration(node)) {
      const local = (spec: ts.ExportSpecifier) => (spec.propertyName ?? spec.name).text
      const leaks = node.exportClause && ts.isNamedExports(node.exportClause)
        ? node.exportClause.elements.some(spec => named.has(local(spec)) || namespaces.has(local(spec)))
        : true
      if (moduleOf(node) === 'expo-router' || (!node.moduleSpecifier && leaks)) faults.add('navigator exported')
    }
    if (ts.isExportAssignment(node) && navigatorOf(node.expression)) faults.add('navigator exported')
    if (ts.isVariableStatement(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && (named.has(declaration.name.text) || namespaces.has(declaration.name.text))) {
          faults.add('navigator exported')
        }
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const attrs = node.attributes.properties
      const spread = attrs.some(ts.isJsxSpreadAttribute)
      let screenLayout: ts.JsxAttribute | undefined
      for (const attr of attrs) {
        if (!ts.isJsxAttribute(attr)) continue
        const name = attr.name.getText(source)
        if (name === 'layout') faults.add(`${tag}: layout`)
        if (name === 'screenLayout') {
          screenLayout = attr
          if (!isScreenTagLayout(attr)) faults.add(`${tag}: screenLayout is not screenTagLayout`)
          else if (!screenTagLayoutImported) faults.add(`${tag}: screenTagLayout is not the one from screen-tag.view`)
        }
      }
      const navigator = navigatorOf(node.tagName)
      if (navigator) {
        navigators.push(navigator)
        if (!screenLayout) faults.add(`${tag}: no screenLayout={screenTagLayout}`)
        if (spread) faults.add(`${tag}: spread`)
      } else if (screenOf(node.tagName) && spread) faults.add(`${tag}: spread`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  return { navigators, faults: [...faults] }
}

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

  // SA-341-02: the mount-time write reaches only screens of a navigator that
  // passes `screenTagLayout`; a navigator added without it is the one way the
  // native tag silently goes back to naming the previous screen. Sol F-08
  // (rounds 3 and 4): the ways around a plain grep are closed by the AST audit
  // above, and each is first shown to be caught before the app tree is read.
  describe('every navigator passes the mount-time screen tag, and nothing overrides it', () => {
    const TAG = `import { screenTagLayout } from '${SCREEN_TAG_MODULE}'`
    const NAMED = `import { Tabs } from 'expo-router'\n${TAG}`
    const NAMESPACE = `import * as Router from 'expo-router'\n${TAG}`
    const clean = (navigators: string[]): NavigatorAudit => ({ navigators, faults: [] })
    const faulty = (navigators: string[], ...faults: string[]): NavigatorAudit => ({ navigators, faults })

    it.each<[string, string, NavigatorAudit]>([
      ['the shape the app uses', `${NAMED}\nexport default () => <Tabs screenLayout={screenTagLayout}><Tabs.Screen name="a" /></Tabs>`, clean(['Tabs'])],
      ['a renamed import', `import { Tabs as T } from 'expo-router'\n${TAG}\nconst v = <T screenLayout={screenTagLayout} />`, clean(['Tabs'])],
      ['an alias', `${NAMED}\nconst AppTabs = Tabs\nconst v = <AppTabs screenLayout={screenTagLayout} />`, clean(['Tabs'])],
      ['an alias of an alias, declared later', `${NAMED}\nconst v = <B screenLayout={screenTagLayout} />\nconst B = A\nconst A = Tabs`, clean(['Tabs'])],
      ['a namespace member', `${NAMESPACE}\nconst v = <Router.Stack screenLayout={screenTagLayout} />`, clean(['Stack'])],
      ['an alias of a namespace member', `${NAMESPACE}\nconst S = Router.Stack\nconst v = <S screenLayout={screenTagLayout} />`, clean(['Stack'])],
      ['a navigator destructured from the namespace', `${NAMESPACE}\nconst { Drawer: D } = Router\nconst v = <D screenLayout={screenTagLayout} />`, clean(['Drawer'])],
      ['no screenLayout', `${NAMED}\nconst v = <Tabs />`, faulty(['Tabs'], 'Tabs: no screenLayout={screenTagLayout}')],
      ['another screenLayout', `${NAMED}\nconst v = <Tabs screenLayout={wrap} />`, faulty(['Tabs'], 'Tabs: screenLayout is not screenTagLayout')],
      ['a local named screenTagLayout', `import { Tabs } from 'expo-router'\nconst screenTagLayout = wrap\nconst v = <Tabs screenLayout={screenTagLayout} />`, faulty(['Tabs'], 'Tabs: screenTagLayout is not the one from screen-tag.view')],
      ['a per-screen layout', `${NAMED}\nconst v = <Tabs screenLayout={screenTagLayout}><Tabs.Screen name="a" layout={wrap} /></Tabs>`, faulty(['Tabs'], 'Tabs.Screen: layout')],
      ['a per-group layout through the namespace', `${NAMESPACE}\nconst v = <Router.Tabs screenLayout={screenTagLayout}><Router.Tabs.Group layout={wrap} /></Router.Tabs>`, faulty(['Tabs'], 'Router.Tabs.Group: layout')],
      ['a spread on a Screen', `${NAMED}\nconst v = <Tabs screenLayout={screenTagLayout}><Tabs.Screen name="a" {...props} /></Tabs>`, faulty(['Tabs'], 'Tabs.Screen: spread')],
      ['a spread on the navigator', `${NAMED}\nconst v = <Tabs screenLayout={screenTagLayout} {...props} />`, faulty(['Tabs'], 'Tabs: spread')],
      ['withLayoutContext', `import { withLayoutContext } from 'expo-router'\nconst Nav = withLayoutContext(X)`, faulty([], 'withLayoutContext')],
      ['a navigator re-exported', `export { Tabs } from 'expo-router'`, faulty([], 'navigator exported')],
      ['a navigator exported under another name', `${NAMED}\nexport const AppTabs = Tabs`, faulty([], 'navigator exported')],
      ['the namespace exported', `${NAMESPACE}\nexport { Router }`, faulty([], 'navigator exported')],
      ['a navigator as the default export', `${NAMED}\nexport default Tabs`, faulty([], 'navigator exported')],
    ])('reports %s', (_case, text, expected) => {
      expect(navigatorAudit('x.tsx', text)).toEqual(expected)
    })

    it('holds on the app tree', () => {
      const sources: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = path.join(dir, name)
          if (statSync(full).isDirectory()) walk(full)
          else if (/\.tsx?$/.test(name) && !full.includes(`${path.sep}__tests__${path.sep}`)) sources.push(full)
        }
      }
      walk(path.join(ROOT, 'src'))

      const audits = sources.map(file => ({ file: path.relative(ROOT, file), ...navigatorAudit(file, readFileSync(file, 'utf8')) }))
      expect(audits.flatMap(a => a.faults.map(fault => `${a.file} ${fault}`))).toEqual([])
      expect(audits.flatMap(a => a.navigators.map(n => `${a.file} ${n}`)).sort()).toEqual([
        'src/app/(tabs)/_layout.tsx Tabs',
        'src/app/_layout.tsx Stack',
      ])
    })
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
