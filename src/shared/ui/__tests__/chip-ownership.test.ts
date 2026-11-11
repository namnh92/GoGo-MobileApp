import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

// These are buttons owned by #541, image/pagination counters, or illustration geometry;
// none is a taxonomy/status/filter chip. Keep exemptions at style-key granularity.
const nonChips: Record<string, string[]> = {
  'account/avatar-editor': ['hint'], // crop instruction over the photo
  'assistant/assistant-fab': ['fab'],
  'assistant/assistant-place-card': ['question'],
  'date-plan/date-plan': ['stopOrderBadge'], // numbered timeline marker
  'date-plan/place-detail': ['emptyCaption', 'galleryDots', 'galleryCount', 'mapCorner'],
  'date-plan/plan-edit': ['iconBtn'],
  'gogo-room/room-manage': ['rowAction'],
  'home/home': ['heroPrimary', 'roomAction'],
  'matching/match-result': ['runnerRank', 'runnerPoints'], // score readouts
  'matching/swipe': ['counterPill'], // deck position
  'onboarding/onboarding-visual': ['index', 'walk'], // illustrated route
  'search/search-empty': ['relaxAction'], // filter-reset action button (#541)
  'review/review': ['ratingPill'], // live star-rating input value
}

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? entry.name === '__tests__' ? [] : files(resolve(dir, entry.name)) : [resolve(dir, entry.name)])
}
function chipStyles(source: string) {
  const ast = ts.createSourceFile('style.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const keys = new Set<string>()
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer)) {
      const props = new Map(node.initializer.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast), p.initializer.getText(ast)]))
      if (/pill|999|99|24/.test(props.get('borderRadius') ?? '') && props.has('paddingHorizontal') && (props.has('backgroundColor') || props.has('borderWidth'))) keys.add(node.name.getText(ast))
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return keys
}
function violations(source: string, surfaces: Set<string>) {
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^(View|Pressable|Text|TouchableOpacity|Animated.View)$/.test(node.tagName.getText(ast))) {
      const style = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'style')
      const refs = style?.getText(ast).matchAll(/styles\.(\w+)/g) ?? []
      for (const [, key] of refs) if (surfaces.has(key) || /^(?:chip|tagBtn)(?:$|[A-Z])|Chip$/.test(key)) found.push(key)
      if (style && /borderRadius:.*(?:pill|999)/.test(style.getText(ast))) found.push('inline capsule')
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

it('features use shared Chip instead of native capsule surfaces', () => {
  const all = files(resolve(src, 'features'))
  const found = all.filter(f => f.endsWith('.tsx') && !f.endsWith('.style.tsx')).flatMap(file => {
    const source = readFileSync(file, 'utf8')
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const surfaces = chipStyles(source)
    // Follow the actual stylesheet import (some feature components share one).
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings) || !bindings.elements.some(e => e.name.text === 'styles')) continue
      const module = statement.moduleSpecifier.text
      const styleFile = module.startsWith('@/') ? resolve(src, `${module.slice(2)}.tsx`) : resolve(dirname(file), `${module}.tsx`)
      if (all.includes(styleFile)) for (const key of chipStyles(readFileSync(styleFile, 'utf8'))) surfaces.add(key)
    }
    const excluded = nonChips[relative(resolve(src, 'features'), file).replace('.view.tsx', '')] ?? []
    return violations(readFileSync(file, 'utf8'), surfaces).filter(key => !excluded.includes(key)).map(key => `${relative(src, file)}:${key}`)
  })
  expect(found).toEqual([])
})
it('the explicitly requested surfaces and legacy wrappers use the one implementation', () => {
  for (const file of ['search/search', 'home/home', 'account/profile-defaults', 'contributions/my-contributions',
    'place-import/contribution-choices', 'create-date/create-budget', 'create-date/create-location-fields']) {
    expect(readFileSync(resolve(src, `features/${file}.view.tsx`), 'utf8')).toMatch(/<Chip[\s>]/)
  }
  expect(readFileSync(resolve(src, 'shared/ui/primitives.tsx'), 'utf8')).toContain("export { Chip, type ChipVariant } from './chip.view'")
})
it('detects renamed pills as well as named chips, and ignores row layout and shared Chip', () => {
  const surfaces = chipStyles('const styles = { renamed: { borderRadius: 999, paddingHorizontal: 12, backgroundColor: theme.surface.card } }')
  expect(violations('<Pressable style={styles.renamed}><Text>Filter</Text></Pressable>', surfaces)).toEqual(['renamed'])
  expect(violations('<View style={styles.chip}><Text>Filter</Text></View>', surfaces)).toEqual(['chip'])
  expect(violations('<View style={styles.chips}><Chip label="Filter" /></View>', surfaces)).toEqual([])
})
