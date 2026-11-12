import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (file: string) => readFileSync(resolve(src, file), 'utf8')
const steps = ['type', 'time', 'budget', 'places']
function elements(source: string, tag: string) {
  const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === tag) found.push(node.getText(ast))
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}
function localTypography(source: string) {
  const ast = ts.createSourceFile('style.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && /title|subtitle|heading|sectionLabel|exactLabel/i.test(node.name.getText(ast))
      && /font(?:Size|Family|Weight)|(?:theme\.)?type\./.test(node.initializer.getText(ast))) found.push(node.name.getText(ast))
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

describe('wizard presentation ownership', () => {
  it.each(steps)('%s directly imports and renders one header without overrides', step => {
    const source = read(`features/create-date/create-${step}.view.tsx`)
    expect(source).toContain("import { WizardStepHeader } from './wizard-step-header.view'")
    const headers = elements(source, 'WizardStepHeader')
    expect(headers).toHaveLength(1)
    expect(headers[0]).not.toMatch(/\b(?:style|variant|fontSize|titleStyle|subtitleStyle)=/)
    expect(localTypography(read(`features/create-date/create-${step}.style.tsx`))).toEqual([])
  })
  it('header owns display/body typography and all three gaps; chrome has no bottom offset', () => {
    const header = read('features/create-date/wizard-step-header.view.tsx')
    expect(header).toContain('variant="display"')
    expect(header).toContain('variant="body" color="text.secondary"')
    const styles = read('features/create-date/wizard-step-header.style.tsx')
    expect(styles).toContain('paddingTop: spacing[6]')
    expect(styles).toContain('marginTop: spacing[2]')
    expect(styles).toContain('marginBottom: spacing[6]')
    expect(read('features/create-date/wizard-step.style.tsx')).toContain('paddingBottom: 0')
  })
  it.each(['shared/ui/group-budget-fields', 'features/create-date/create-time-fields', 'features/create-date/create-places'])('%s uses the common section label', file => {
    expect(read(`${file}.view.tsx`)).toMatch(/import \{ SectionLabel \} from/)
    expect(elements(read(`${file}.view.tsx`), 'SectionLabel').length).toBeGreaterThan(0)
    expect(localTypography(read(`${file}.style.tsx`))).toEqual([])
  })
  it('budget modes and amount options use one card; create and edit use the same count/mode/amount fields', () => {
    for (const file of ['shared/ui/group-budget-fields', 'features/create-date/budget-picker', 'shared/ui/room-budget-field']) {
      const source = read(`${file}.view.tsx`)
      expect(source).toMatch(/import \{ BudgetOptionCard \} from/)
      expect(elements(source, 'BudgetOptionCard').length).toBeGreaterThan(0)
    }
    for (const file of ['features/create-date/create-budget', 'features/gogo-room/room-editor']) {
      const source = read(`${file}.view.tsx`)
      for (const component of ['RoomBudgetField', 'GroupBudgetFields']) {
        expect(source).toMatch(new RegExp(`import \\{ ${component} \\} from '@/shared/ui/`))
        expect(elements(source, component)).toHaveLength(1)
      }
      expect(source.indexOf('<GroupBudgetFields')).toBeLessThan(source.indexOf('<RoomBudgetField'))
      expect(elements(source, 'BudgetPicker')).toHaveLength(0)
    }
  })
  it('retires the group setup implementation and recommendation query, keeping a compatibility redirect', () => {
    for (const file of ['group-setup.view.tsx', 'group-setup.style.tsx', 'create-places-query.ts']) expect(existsSync(resolve(src, 'features/create-date', file))).toBe(false)
    expect(read('features/create-date/legacy-group-setup.view.tsx')).toContain('<Redirect href="/create/budget"')
    expect(read('features/create-date/create-places.view.tsx')).not.toMatch(/usePlaceSearch|fetchNextPage|suggestions|PullToRefresh|ListEmptyComponent/)
  })
  it('detects local font declarations and type spreads', () => {
    expect(localTypography('const x = { title: { fontSize: 20 }, subtitle: { ...type.body }, sectionHeading: { ...theme.type.label }, input: { ...type.body } }')).toEqual(['title', 'subtitle', 'sectionHeading'])
  })
})
