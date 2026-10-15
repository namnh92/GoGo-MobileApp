import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * A control with no role is announced by VoiceOver as plain text, so a screen
 * reader user cannot tell it is actionable. That is a P0 accessibility defect
 * under the quality gates, and it is easy to reintroduce — hence a static
 * guard rather than a one-off audit.
 */

const SOURCE_ROOT = join(__dirname, '..', '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

/**
 * The opening tag only — props after the first `>` belong to the children.
 *
 * Two operators put a `>` inside a prop and must not be mistaken for the end of
 * the tag: `=>` in a handler, and `>=` in a comparison. Truncating at `>=`
 * hides every prop after it, which reported a control as unlabelled when its
 * `accessibilityRole` merely sat below a `disabled={count >= MAX}`.
 */
function openingTags(source: string, component: string): { tag: string; line: number }[] {
  const tags: { tag: string; line: number }[] = []
  const opener = new RegExp(`<${component}\\b`, 'g')
  let match: RegExpExecArray | null
  while ((match = opener.exec(source))) {
    let end = match.index
    while (
      end < source.length &&
      !(source[end] === '>' && source[end - 1] !== '=' && source[end + 1] !== '=')
    ) {
      end += 1
    }
    tags.push({ tag: source.slice(match.index, end), line: source.slice(0, match.index).split('\n').length })
  }
  return tags
}

/**
 * Lines of JSX elements whose `accessibilityState` may report `busy` but that
 * carry no `accessibilityLabel` of their own. Parsed, not pattern-matched, so
 * shorthand, spacing and `>` inside props cannot hide one; a state the parser
 * cannot resolve (a variable, a spread) counts as busy.
 */
function unlabelledBusy(source: string): number[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines: number[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const props = node.attributes.properties.filter(ts.isJsxAttribute)
      const named = (name: string) => props.find(prop => prop.name.getText(file) === name)
      const state = named('accessibilityState')
      const value =
        state?.initializer && ts.isJsxExpression(state.initializer) ? state.initializer.expression : undefined
      const mayBeBusy =
        state !== undefined &&
        (value === undefined ||
          !ts.isObjectLiteralExpression(value) ||
          value.properties.some(p => ts.isSpreadAssignment(p) || p.name?.getText(file) === 'busy'))
      if (mayBeBusy && !named('accessibilityLabel')) {
        lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return lines
}

describe('accessibility', () => {
  const files = sourceFiles(SOURCE_ROOT)

  it('scans the whole app, not an empty list', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('gives every control a role or a label', () => {
    const offenders = files.flatMap(file =>
      openingTags(readFileSync(file, 'utf8'), 'Pressable')
        .filter(({ tag }) => !/accessibilityRole|accessibilityLabel/.test(tag))
        // A modal backdrop is a dismiss surface, not a control worth announcing.
        .filter(({ tag }) => !tag.includes('styles.backdrop'))
        .map(({ line }) => `${file.replace(SOURCE_ROOT, 'src')}:${line}`),
    )
    expect(offenders).toEqual([])
  })

  // #271: Android writes contentDescription only when label + state is
  // non-empty, so a control that reports `busy` with no label keeps announcing
  // "busy" after the work ends, whatever its visible text says.
  it('labels every control that reports busy', () => {
    const offenders = files.flatMap(file =>
      unlabelledBusy(readFileSync(file, 'utf8')).map(line => `${file.replace(SOURCE_ROOT, 'src')}:${line}`),
    )
    expect(offenders).toEqual([])
  })

  it('finds a busy state in every written form', () => {
    const one = (jsx: string) => unlabelledBusy(`const x = (\n${jsx}\n)`)
    expect(one('<Pressable accessibilityState={{ disabled: a, busy: b }} />')).toEqual([2])
    expect(one('<Pressable accessibilityState={{ busy }} />')).toEqual([2])
    expect(one('<Pressable disabled={n > 1} accessibilityState={{ busy : b }} />')).toEqual([2])
    expect(one('<View accessibilityState={{ busy }} />')).toEqual([2])
    // Unresolved: a state object or a spread may carry busy.
    expect(one('<Pressable accessibilityState={state} />')).toEqual([2])
    expect(one('<Pressable accessibilityState={{ ...state }} />')).toEqual([2])
    // A label only from a spread is not visible here, so it does not count.
    expect(one('<Pressable {...rest} accessibilityState={{ busy }} />')).toEqual([2])
    expect(one('<Pressable accessibilityLabel={l} accessibilityState={{ busy }} />')).toEqual([])
    expect(one('<Pressable accessibilityState={{ selected: s }} />')).toEqual([])
  })

  it('keeps every control under 44pt reachable through a hit slop', () => {
    const SMALL = /\b(?:height|width):\s*(?:[0-9]|[1-3][0-9]|4[0-3])\b/
    const offenders = files
      .filter(file => file.endsWith('.style.tsx') || file.endsWith('primitives.tsx'))
      .flatMap(file => {
        const source = readFileSync(file, 'utf8')
        const viewFile = file.replace('.style.tsx', '.view.tsx')
        let view = ''
        try {
          view = readFileSync(viewFile, 'utf8')
        } catch {
          view = source
        }
        return [...source.matchAll(/^\s*(\w*(?:Btn|Button|Toggle)\w*):\s*\{([^}]*)\}/gm)]
          .filter(([, , body]) => SMALL.test(body))
          // A shadow's offset is not a touch target.
          .filter(([, name]) => !/Shadow$/.test(name))
          .filter(([, name]) => {
            // Reachable if the control that wears this style widens its slop.
            const used = new RegExp(`styles\\.${name}\\b`)
            return !openingTags(view, 'Pressable').some(
              ({ tag }) => used.test(tag) && tag.includes('hitSlop'),
            )
          })
          .map(([, name]) => `${file.replace(SOURCE_ROOT, 'src')}: ${name}`)
      })
    expect(offenders).toEqual([])
  })
})
