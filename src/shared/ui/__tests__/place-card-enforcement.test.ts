import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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
  if (path !== 'date-plan/place-detail.view.tsx' && /<PlaceAddressText\b/.test(source)) found.push('custom address row')
  if (/t\(['"](?:discovery\.(?:googleRating|gogoRating|gogoFewReviews)|rating\.gogoScore|assistant\.card\.rating|placeDetail\.gogoBelowThreshold)['"]/.test(source)) found.push('custom rating badge')
  if (/<(?:View|Text|Chip|Badge)\b[^>]*(?:styles\.(?:addressRow|googleBadge|gogoBadge|photoChip|imageChip|ratingBadge)|label=\{[^}]*\.(?:gogoRating|googleRating)\b)/s.test(source)) found.push('custom place fact decoration')
  if (path !== 'date-plan/place-detail.view.tsx' && /t\(['"](?:search\.(?:openUntil|closedOpens)|discovery\.(?:openUntil|closedTomorrow|closedLater)|assistant\.card\.(?:openNow|closedNow))['"]/.test(source)) found.push('custom image status chip')
  // Inspect render expressions, independent of style names or translation keys.
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function visit(node: ts.Node) {
    if (ts.isJsxExpression(node) && node.parent && ts.isJsxElement(node.parent) && node.parent.openingElement.tagName.getText(file) === 'Text') {
      function fact(child: ts.Node) {
        if (ts.isPropertyAccessExpression(child) && ['rating', 'googleRating', 'gogoRating', 'addressText'].includes(child.name.text) && child.expression.getText(file) !== 'review') found.push('inline place fact')
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
    ['<Text>{place.addressText}</Text>', 'inline place fact'],
    ["<Chip label={t('search.openUntil', { time })} />", 'custom image status chip'],
    ['<PlaceAddressText place={place} />', 'custom address row'],
    ["import { PlacePhoto } from '@/shared/ui/place-photo.view'", 'custom place image'],
  ])('rejects a duplicate renderer: %s', (source, reason) => {
    expect(violations(source, 'new-feature/new.view.tsx')).toContain(reason)
  })
})
