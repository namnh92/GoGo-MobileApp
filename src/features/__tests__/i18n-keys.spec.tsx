/**
 * APP-036 (#188) — a missing key renders as its own name. The home profile
 * button announced "profile.title" to VoiceOver for months because nothing
 * failed: i18next returns the key, the screen still draws, and only a screen
 * reader user hears the difference.
 */
import { readdirSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import * as ts from 'typescript'

import type { RoomType } from '@/shared/api/types'
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
 * - A literal key, or each literal branch of `cond ? 'a' : 'b'` (nested too),
 *   `x ?? 'a'` and `({ CODE: 'a' })[code]`, must exist as written.
 * - A call passing `context` resolves through its base key; without one it
 *   needs a variant for every value the context can take: the literal when it
 *   is one, otherwise every contract room type (`_couple` and `_group`).
 * - A call passing `count` resolves through its base key or its `_other`
 *   variant (i18next 26 falls back to the base key when no plural exists).
 * - A template key (`plans.status.${status}`) must match at least one message.
 * - Anything else is computed at runtime and cannot be read here, so it must be
 *   listed in COMPUTED_KEYS, and its source is typed as MessageKey so tsc checks
 *   it: a new one fails until someone looks at it.
 *
 * Known limits:
 * - COMPUTED_KEYS matches the expression's text. Reformatting or renaming it
 *   fails the check, and another call with identical text in the same file
 *   passes without being looked at.
 * - Options passed as a variable or a spread are not read: their `context` or
 *   `count` is invisible, so the base key is required.
 * - A non-literal `context` is assumed to be a room type; every context in the
 *   app today is `room.type`.
 * - A template key passes when one message matches its shape. The type of the
 *   substitution is not read (that needs a type-checked program), so a runtime
 *   value with no message is not caught here.
 * - Only `t(…)`, `i18n.t(…)` and `i18next.t(…)` are read.
 */

const SRC = join(__dirname, '..', '..')
const ROOT = join(SRC, '..')

/**
 * Computed keys, by file, as the expression is written (whitespace collapsed),
 * with the typing that makes tsc keep each one inside the catalogs.
 */
const COMPUTED_KEYS: Record<string, readonly string[]> = {
  'src/features/account/account.view.tsx': ['avatarErrorKey(error)'], // returns MessageKey
  'src/features/create-date/create-type.view.tsx': ['option.titleKey', 'option.descKey'], // typed as key literals
  'src/features/create-date/group-setup.view.tsx': ['option.labelKey'], // typed as key literals
  'src/features/date-plan/place-detail.view.tsx': ['priceUnitKey(price.unit)'], // priceUnitKey returns MessageKey
  'src/features/date-plan/place-reviews.view.tsx': ['option.labelKey'], // ORDERS satisfies { labelKey: MessageKey }
  'src/features/gogo-room/gogo-room.view.tsx': ['chip.key'], // STATUS_CHIP key: MessageKey
  'src/features/matching/match-result.view.tsx': [
    'priceUnitKey(winnerPrice.unit)', // priceUnitKey returns MessageKey
    'regenerateErrorKey(regenerate.error)', // typed as key literals
  ],
  'src/features/matching/swipe.view.tsx': ['priceUnitKey(price.unit)'], // priceUnitKey returns MessageKey
  'src/features/notifications/notification-switch.view.tsx': ['DEVICE_NOTE[pushState]'], // Record<PushState, MessageKey>
  'src/features/onboarding/onboarding.view.tsx': ['current.titleKey', 'current.bodyKey'], // typed as MessageKey
  'src/features/review/review.view.tsx': ['ratingLabelKey(rating)'], // returns MessageKey
  'src/shared/ui/place-card.view.tsx': ['priceUnitKey(unit)'], // priceUnitKey returns MessageKey
}

type KeyRef =
  | { kind: 'literal'; key: string }
  | { kind: 'template'; source: string; pattern: string }
  | { kind: 'computed'; source: string }

/** What the call's options let i18next resolve besides the base key. */
interface Options {
  /** Values `context` can take, when it is passed. */
  contexts: readonly string[] | null
  count: boolean
}

interface Usage {
  file: string
  line: number
  ref: KeyRef
  options: Options
}

/** Every value `room.type` can take; the Record fails tsc when the contract adds one. */
const ROOM_CONTEXTS = Object.keys({ couple: true, group: true } satisfies Record<RoomType, true>)

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

function readOptions(options: ts.Expression | undefined): Options {
  const read: Options = { contexts: null, count: false }
  if (!options || !ts.isObjectLiteralExpression(options)) return read
  for (const property of options.properties) {
    const name = property.name !== undefined && ts.isIdentifier(property.name) ? property.name.text : null
    if (name === 'count') read.count = true
    if (name === 'context') {
      const value = ts.isPropertyAssignment(property) ? unwrap(property.initializer) : null
      read.contexts = value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) ? [value.text] : ROOM_CONTEXTS
    }
  }
  return read
}

function usages(): Usage[] {
  return sourceFiles(SRC).flatMap(path => {
    const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    const name = relative(ROOT, path).split(sep).join('/')
    const found: Usage[] = []
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && isTranslate(node.expression) && node.arguments[0]) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
        const options = readOptions(node.arguments[1])
        for (const ref of keyRefs(node.arguments[0], file)) found.push({ file: name, line, ref, options })
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

function resolves(keys: readonly string[], pattern: string, { contexts, count }: Options): boolean {
  const has = (source: string) => {
    const matcher = new RegExp(`^${source}$`)
    return keys.some(key => matcher.test(key))
  }
  if (has(pattern)) return true
  if (count && has(`${pattern}_other`)) return true
  return contexts !== null && contexts.every(value => has(`${pattern}_${escapeRegExp(value)}`))
}

describe('keys the app source asks for', () => {
  const found = usages()

  it('reads every literal of a nested conditional key, and flags a bare variable', () => {
    const file = ts.createSourceFile(
      'probe.tsx',
      "t(isApiError(error) ? (error.code === 'ROOM_NOT_ACTIVE' ? 'probe.notActive' : 'probe.failed') : 'probe.offline'); t(startErrorKey)",
      ts.ScriptTarget.Latest,
      true,
    )
    const calls: ts.CallExpression[] = []
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && isTranslate(node.expression)) calls.push(node)
      ts.forEachChild(node, visit)
    }
    visit(file)
    expect(calls.map(call => keyRefs(call.arguments[0], file))).toEqual([
      [
        { kind: 'literal', key: 'probe.notActive' },
        { kind: 'literal', key: 'probe.failed' },
        { kind: 'literal', key: 'probe.offline' },
      ],
      [{ kind: 'computed', source: 'startErrorKey' }],
    ])
  })

  it('takes a base key, a variant for every room type with context, or _other with count', () => {
    const keys = ['a.base', 'b.title_couple', 'b.title_group', 'c.title_group', 'd.marks_other', 'e.marks_one']
    const withContext: Options = { contexts: ROOM_CONTEXTS, count: false }
    const withCount: Options = { contexts: null, count: true }
    expect(resolves(keys, escapeRegExp('a.base'), withContext)).toBe(true)
    expect(resolves(keys, escapeRegExp('b.title'), withContext)).toBe(true)
    // Without a base key, a couple room would render the raw key.
    expect(resolves(keys, escapeRegExp('c.title'), withContext)).toBe(false)
    expect(resolves(keys, escapeRegExp('c.title'), { contexts: ['group'], count: false })).toBe(true)
    expect(resolves(keys, escapeRegExp('d.marks'), withCount)).toBe(true)
    expect(resolves(keys, escapeRegExp('e.marks'), withCount)).toBe(false)
    expect(resolves(keys, escapeRegExp('b.title'), { contexts: null, count: false })).toBe(false)
  })

  it('reads the translate calls at all', () => {
    // A scan that silently matched nothing would pass every check below.
    expect(found.filter(usage => usage.ref.kind === 'literal').length).toBeGreaterThan(500)
  })

  it('finds every literal key in both catalogs', () => {
    const missing = CATALOGS.flatMap(([locale, keys]) =>
      found.flatMap(({ file, line, ref, options }) =>
        ref.kind === 'literal' && !resolves(keys, escapeRegExp(ref.key), options)
          ? [`${locale}:${ref.key} (${file}:${line})`]
          : [],
      ),
    )
    expect(missing).toEqual([])
  })

  it('matches every template key to at least one message in both catalogs', () => {
    const unmatched = CATALOGS.flatMap(([locale, keys]) =>
      found.flatMap(({ file, line, ref, options }) =>
        ref.kind === 'template' && !resolves(keys, ref.pattern, options)
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
