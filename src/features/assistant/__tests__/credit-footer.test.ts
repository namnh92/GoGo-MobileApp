import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(__dirname, file), 'utf8')
const source = ts.createSourceFile('assistant.tsx', read('../assistant.view.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function elements(name: string) {
  const matches: ts.JsxElement[] = []
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === name) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return matches
}

describe('assistant credit footer ownership (#633)', () => {
  it('puts composer then assistant credit in one footer inside keyboard avoidance', () => {
    const avoiding = elements('KeyboardAvoidingView')[0]
    const footer = elements('View').find(node => node.openingElement.attributes.getText(source).includes('testID="assistant-footer"'))!
    expect(footer.parent).toBe(avoiding)
    const controls = footer.children.filter(ts.isJsxSelfClosingElement)
    expect(controls.map(node => node.tagName.getText(source))).toEqual(['Composer', 'CreditBalanceRow'])
    expect(controls[1].attributes.getText(source)).toBe('assistant')
    expect(avoiding.openingElement.attributes.getText(source)).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}")
  })

  it('owns the safe-area inset after both controls and drops it with the keyboard', () => {
    const footer = elements('View').find(node => node.openingElement.attributes.getText(source).includes('testID="assistant-footer"'))!
    expect(footer.openingElement.attributes.getText(source)).toContain('styles.footer(keyboard ? 0 : insets.bottom)')
    expect(read('../composer.view.tsx')).not.toContain('useSafeAreaInsets')
    expect(read('../composer.view.tsx')).not.toContain('paddingBottom:')
  })
})
