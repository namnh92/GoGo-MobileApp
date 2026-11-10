import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const root = join(process.cwd(), 'src/features')
function featureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? entry.name === '__tests__' ? [] : featureFiles(join(dir, entry.name))
    : entry.name.endsWith('.tsx') ? [join(dir, entry.name)] : [])
}

// Detail media and review thumbnails belong to detail/review entities, not place cards.
const mediaOwners = new Set(['date-plan/place-detail.view.tsx', 'contributions/my-contributions.view.tsx'])
function violations(source: string, path: string) {
  const found: string[] = []
  if (!mediaOwners.has(path) && /import\s*\{[^}]*\bPlacePhoto\b[^}]*\}\s*from/.test(source)) found.push('custom place image')
  if (/<(?:PlaceCard|PlaceCardView)\b/.test(source)) found.push('legacy card composition')
  if (path !== 'date-plan/place-detail.view.tsx' && /<PlaceAddressText\b/.test(source)) found.push('custom address row')
  if (/t\(['"](?:discovery\.(?:googleRating|gogoRating|gogoFewReviews)|rating\.gogoScore|assistant\.card\.rating|placeDetail\.gogoBelowThreshold)['"]/.test(source)) found.push('custom rating badge')
  if (/<(?:View|Text|Chip|Badge)\b[^>]*(?:styles\.(?:addressRow|googleBadge|gogoBadge|photoChip|imageChip|ratingBadge)|label=\{[^}]*\.(?:gogoRating|googleRating)\b)/s.test(source)) found.push('custom place fact decoration')
  if (path !== 'date-plan/place-detail.view.tsx' && /t\(['"](?:search\.(?:openUntil|closedOpens)|discovery\.(?:openUntil|closedTomorrow|closedLater)|assistant\.card\.(?:openNow|closedNow))['"]/.test(source)) found.push('custom image status chip')
  // Inspect render expressions, independent of style names or translation keys.
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function visit(node: ts.Node) {
    if (ts.isJsxExpression(node) && node.parent && ts.isJsxElement(node.parent) && node.parent.openingElement.tagName.getText(file) === 'Text') {
      function fact(child: ts.Node) {
        if (ts.isPropertyAccessExpression(child) && child.name.text === 'name' && child.parent === node && /^(?:place|selectedPlace|candidate|facts|winner|card)$/.test(child.expression.getText(file)) && path !== 'date-plan/place-detail.view.tsx') found.push('inline place name')
        if (ts.isPropertyAccessExpression(child) && ['rating', 'googleRating', 'gogoRating', 'addressText', 'address'].includes(child.name.text) && child.expression.getText(file) !== 'review') found.push('inline place fact')
        ts.forEachChild(child, fact)
      }
      fact(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

describe('place card ownership', () => {
  it('features delegate place facts and imagery to the shared card', () => {
    const failures = featureFiles(root).flatMap(file => {
      const path = file.slice(root.length + 1)
      return violations(readFileSync(file, 'utf8'), path).map(problem => `${path}: ${problem}`)
    })
    expect(failures).toEqual([])
  })
  it.each([
    ['<View style={styles.addressRow}><Text>{address}</Text></View>', 'custom place fact decoration'],
    ["t('discovery.googleRating', { score: 4.5 })", 'custom rating badge'],
    ["t('assistant.card.rating', { rating: facts.gogoRating })", 'custom rating badge'],
    ['<View style={styles.photoChip} />', 'custom place fact decoration'],
    ['<Text>{facts.googleRating}</Text>', 'inline place fact'],
    ['<Text>{candidate.address}</Text>', 'inline place fact'],
    ['<Text>{candidate.name}</Text>', 'inline place name'],
    ['<PlaceCard variant="saved-city" place={place} />', 'legacy card composition'],
    ['<Text>{place.addressText}</Text>', 'inline place fact'],
    ["<Chip label={t('search.openUntil', { time })} />", 'custom image status chip'],
    ['<PlaceAddressText place={place} />', 'custom address row'],
    ["import { PlacePhoto } from '@/shared/ui/place-photo.view'", 'custom place image'],
  ])('rejects a duplicate renderer: %s', (source, reason) => {
    expect(violations(source, 'new-feature/new.view.tsx')).toContain(reason)
  })
})

// Owner 2026-11-08: screens import one of two common compositions; no layout selector.
const selections = [
  ['home/home.view.tsx', ['PlaceCardLarge']],
  ['search/search.view.tsx', ['PlaceCardLarge', 'PlaceCardSmall']],
  ['tabs/saved.view.tsx', ['PlaceCardLarge']], // Saved and Saved City share this exact expression.
  ['search/search-empty.view.tsx', ['PlaceCardSmall']],
  ['place-import/existing-place-result.view.tsx', ['PlaceCardSmall']],
  ['place-import/import.view.tsx', ['PlaceCardLarge', 'PlaceCardSmall']],
  ['assistant/result-card.view.tsx', ['PlaceCardSmall']],
  ['date-plan/date-plan.view.tsx', ['PlaceCardLarge']],
  ['date-plan/plan-edit.view.tsx', ['PlaceCardSmall']],
  ['active-date/active-date.view.tsx', ['PlaceCardLarge', 'PlaceCardSmall']],
  ['matching/swipe.view.tsx', ['PlaceCardLarge']],
  ['matching/match-result.view.tsx', ['PlaceCardLarge', 'PlaceCardSmall']],
  ['review/shared-result.view.tsx', ['PlaceCardLarge']],
  ['review/my-reviews.view.tsx', ['PlaceCardSmall']],
  ['contributions/my-contributions.view.tsx', ['ContributionPlaceCard']],
] as const

describe('#564 exactly two common place-card components', () => {
  it('AI and the add-place result sheet use the same small-card component and exact props shape', () => {
    const selections = ['assistant/result-card.view.tsx', 'place-import/existing-place-result.view.tsx'].map(path => {
      const file = ts.createSourceFile(path, readFileSync(join(root, path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const cards: { component: string; props: string[] }[] = []
      function visit(node: ts.Node) {
        if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === 'PlaceCardSmall') {
          cards.push({ component: node.tagName.getText(file), props: node.attributes.properties.map(prop => ts.isJsxAttribute(prop) ? prop.name.getText(file) : 'spread').sort() })
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
      expect(file.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === '@/shared/ui/place-card-small.view')).toBe(true)
      return cards
    })
    expect(selections[0]).toEqual(selections[1])
    expect(selections[0]).toEqual([{ component: 'PlaceCardSmall', props: ['onPress', 'place'] }])
  })
  it.each(selections)('%s selects the common composition', (path, components) => {
    const source = readFileSync(join(root, path), 'utf8')
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const cards: { component: string; props: string[] }[] = []
    function visit(node: ts.Node) {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const component = node.tagName.getText(file)
        if ((component.startsWith('PlaceCard') || component === 'ContributionPlaceCard') && component !== 'PlaceCardSkeleton') cards.push({ component, props: node.attributes.properties.map(prop => ts.isJsxAttribute(prop) ? prop.name.getText(file) : 'spread') })
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    expect([...new Set(cards.map(card => card.component))].sort()).toEqual([...components].sort())
    for (const card of cards) {
      expect(card.props).not.toContain('variant')
      expect(card.props).not.toContain('appearance')
      expect(card.props).not.toContain('showPhoto')
    }
  })
  it('Home, Explore, Saved and Saved City pin the same common component and interaction props', () => {
    const actual = ['home/home.view.tsx', 'search/search.view.tsx', 'tabs/saved.view.tsx', 'tabs/saved.view.tsx'].map(path => {
      const source = readFileSync(join(root, path), 'utf8')
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const cards: { component: string; interactionProps: string[]; layoutProps: string[] }[] = []
      function visit(node: ts.Node) {
        if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === 'PlaceCardLarge') {
          const keys = node.attributes.properties.flatMap(prop => ts.isJsxAttribute(prop) ? [prop.name.getText(file)] : [])
          cards.push({ component: node.tagName.getText(file),
            interactionProps: keys.filter(key => ['place', 'onPress', 'saved', 'onToggleSave'].includes(key)).sort(),
            layoutProps: keys.filter(key => ['variant', 'appearance', 'showPhoto', 'photoCategoryLabel'].includes(key)) })
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
      expect(cards).toHaveLength(1)
      return cards[0]
    })
    for (const card of actual) expect(card).toEqual(actual[0])
    expect(actual).toMatchSnapshot('Home / Explore / Saved / Saved City structure')
  })
  it('forbids feature imports of alternative card compositions and shared fact renderers', () => {
    const failures: string[] = []
    for (const path of featureFiles(root)) {
      const relative = path.slice(root.length + 1)
      const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      for (const node of file.statements) {
        if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue
        const module = node.moduleSpecifier.text
        if (module.includes('/ui/place-card') && !['@/shared/ui/place-card-large.view', '@/shared/ui/place-card-small.view'].includes(module)) {
          failures.push(relative + ': ' + module)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
