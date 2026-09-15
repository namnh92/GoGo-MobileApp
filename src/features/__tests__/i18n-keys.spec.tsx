/**
 * APP-036 (#188) — a missing key renders as its own name. The home profile
 * button announced "profile.title" to VoiceOver for months because nothing
 * failed: i18next returns the key, the screen still draws, and only a screen
 * reader user hears the difference.
 */
import { readdirSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import * as ts from 'typescript'

import { viMessages } from '@/shared/i18n/vi'
import { enMessages } from '@/shared/i18n/en'

const KEY_SHAPED = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+$/

describe('i18n message tables', () => {
  it('has the key the home profile button asks for', () => {
    expect(viMessages['profile.title']).toBeTruthy()
    expect(enMessages['profile.title']).toBeTruthy()
  })

  // #200: the host's "continue with a pending member" dialog showed COMMON.CANCEL.
  it('has the cancel label the confirm dialogs ask for', () => {
    expect(viMessages['common.cancel']).toBeTruthy()
    expect(enMessages['common.cancel']).toBeTruthy()
  })

  it('never resolves a key to its own name', () => {
    for (const [name, table] of [
      ['vi', viMessages],
      ['en', enMessages],
    ] as const) {
      const echoed = Object.entries(table)
        .filter(([key, value]) => key === value)
        .map(([key]) => `${name}:${key}`)
      expect(echoed).toEqual([])
    }
  })

  it('carries every Vietnamese key in English too', () => {
    const missing = Object.keys(viMessages).filter(key => !(key in enMessages))
    expect(missing).toEqual([])
  })

  it('has no value that is merely a key-shaped string', () => {
    const suspicious = Object.entries(viMessages)
      .filter(([, value]) => typeof value === 'string' && KEY_SHAPED.test(value))
      .map(([key]) => key)
    expect(suspicious).toEqual([])
  })
})

/**
 * #200 — the catalogs above can be perfect and a screen can still ask for a key
 * that is in neither: `t('common.cancel')` rendered as COMMON.CANCEL on a
 * device. So read every `t(…)` call in the app source and check what it asks
 * for against both catalogs.
 *
 * - A literal key, or each literal branch of `cond ? 'a' : 'b'`, `x ?? 'a'` and
 *   `({ CODE: 'a' })[code]`, must exist as written.
 * - A call passing `context` or `count` may be satisfied by a suffixed variant
 *   (`gogoRoom.title_group`), which is how i18next resolves it.
 * - A template key (`plans.status.${status}`) must match at least one message.
 * - Anything else is computed at runtime and cannot be read here, so it must be
 *   listed in COMPUTED_KEYS: a new one fails until someone looks at it.
 */

const SRC = join(__dirname, '..', '..')
const ROOT = join(SRC, '..')

/**
 * Computed keys, by file, as the expression is written (whitespace collapsed),
 * with what keeps each one inside the catalogs.
 */
const COMPUTED_KEYS: Record<string, readonly string[]> = {
  'src/features/account/account.view.tsx': ['avatarErrorKey(error)'], // returns key literals only
  'src/features/create-date/create-type.view.tsx': ['option.titleKey', 'option.descKey'], // typed as key literals
  'src/features/create-date/group-setup.view.tsx': ['option.labelKey'], // typed as key literals
  'src/features/date-plan/place-detail.view.tsx': ['priceUnitKey(price.unit)'], // `price.unit.${PriceUnit}`
  'src/features/date-plan/place-reviews.view.tsx': ['option.labelKey'], // const table of key literals
  'src/features/gogo-room/gogo-room.view.tsx': ['chip.key'], // STATUS_CHIP table of key literals
  'src/features/matching/match-result.view.tsx': [
    'priceUnitKey(winnerPrice.unit)', // `price.unit.${PriceUnit}`
    'regenerateErrorKey(regenerate.error)', // typed as key literals
  ],
  'src/features/matching/swipe.view.tsx': ['priceUnitKey(price.unit)'], // `price.unit.${PriceUnit}`
  'src/features/notifications/notification-switch.view.tsx': ['DEVICE_NOTE[pushState]'], // Record<PushState, MessageKey>
  'src/features/onboarding/onboarding.view.tsx': ['current.titleKey', 'current.bodyKey'], // typed as MessageKey
  'src/features/review/review.view.tsx': ['ratingLabelKey(rating)'], // returns MessageKey
  'src/shared/ui/place-card.view.tsx': ['priceUnitKey(unit)'], // `price.unit.${PriceUnit}`
}

type KeyRef =
  | { kind: 'literal'; key: string }
  | { kind: 'template'; source: string; pattern: string }
  | { kind: 'computed'; source: string }

interface Usage {
  file: string
  line: number
  ref: KeyRef
  /** `context` or `count` was passed, so a suffixed variant resolves too. */
  variants: boolean
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || path === join(SRC, 'shared', 'i18n') ? [] : sourceFiles(path)
    }
    return /\.tsx?$/.test(entry.name) && !/\.(d|spec|test)\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function unwrap(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function keyRefs(expression: ts.Expression, file: ts.SourceFile): KeyRef[] {
  const node = unwrap(expression)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ kind: 'literal', key: node.text }]
  if (ts.isConditionalExpression(node)) return [...keyRefs(node.whenTrue, file), ...keyRefs(node.whenFalse, file)]
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return [...keyRefs(node.left, file), ...keyRefs(node.right, file)]
  }
  if (ts.isElementAccessExpression(node)) {
    const lookup = unwrap(node.expression)
    if (ts.isObjectLiteralExpression(lookup) && lookup.properties.every(ts.isPropertyAssignment)) {
      return lookup.properties.flatMap(property => keyRefs((property as ts.PropertyAssignment).initializer, file))
    }
  }
  if (ts.isTemplateExpression(node)) {
    const pattern = escapeRegExp(node.head.text) + node.templateSpans.map(span => `.+${escapeRegExp(span.literal.text)}`).join('')
    return [{ kind: 'template', source: node.getText(file), pattern }]
  }
  return [{ kind: 'computed', source: node.getText(file).replace(/\s+/g, ' ') }]
}

function isTranslate(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return callee.text === 't'
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't' && /^(i18n|i18next)$/.test(callee.expression.getText())
}

function passesVariants(options: ts.Expression | undefined): boolean {
  if (!options || !ts.isObjectLiteralExpression(options)) return false
  return options.properties.some(property => property.name !== undefined && ts.isIdentifier(property.name) && /^(context|count)$/.test(property.name.text))
}

function usages(): Usage[] {
  return sourceFiles(SRC).flatMap(path => {
    const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    const name = relative(ROOT, path).split(sep).join('/')
    const found: Usage[] = []
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && isTranslate(node.expression) && node.arguments[0]) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
        const variants = passesVariants(node.arguments[1])
        for (const ref of keyRefs(node.arguments[0], file)) found.push({ file: name, line, ref, variants })
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    return found
  })
}

const CATALOGS = [
  ['vi', Object.keys(viMessages)],
  ['en', Object.keys(enMessages)],
] as const

function resolves(keys: readonly string[], pattern: string, variants: boolean): boolean {
  const matcher = new RegExp(`^${pattern}${variants ? '(?:_[A-Za-z0-9]+)?' : ''}$`)
  return keys.some(key => matcher.test(key))
}

describe('keys the app source asks for', () => {
  const found = usages()

  it('reads the translate calls at all', () => {
    // A scan that silently matched nothing would pass every check below.
    expect(found.filter(usage => usage.ref.kind === 'literal').length).toBeGreaterThan(500)
  })

  it('finds every literal key in both catalogs', () => {
    const missing = CATALOGS.flatMap(([locale, keys]) =>
      found.flatMap(({ file, line, ref, variants }) =>
        ref.kind === 'literal' && !resolves(keys, escapeRegExp(ref.key), variants)
          ? [`${locale}:${ref.key} (${file}:${line})`]
          : [],
      ),
    )
    expect(missing).toEqual([])
  })

  it('matches every template key to at least one message in both catalogs', () => {
    const unmatched = CATALOGS.flatMap(([locale, keys]) =>
      found.flatMap(({ file, line, ref, variants }) =>
        ref.kind === 'template' && !resolves(keys, ref.pattern, variants)
          ? [`${locale}:${ref.source} (${file}:${line})`]
          : [],
      ),
    )
    expect(unmatched).toEqual([])
  })

  it('lists every computed key it cannot read', () => {
    const unlisted = found.flatMap(({ file, line, ref }) =>
      ref.kind === 'computed' && !(COMPUTED_KEYS[file] ?? []).includes(ref.source) ? [`${file}:${line} t(${ref.source})`] : [],
    )
    expect(unlisted).toEqual([])
  })
})
