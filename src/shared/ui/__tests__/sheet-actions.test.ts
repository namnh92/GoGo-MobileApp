import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

function views(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? views(path.join(dir, entry.name))
    : entry.name.endsWith('.view.tsx') ? [path.join(dir, entry.name)] : [])
}

it('requires every sheet command to use the shared horizontal action area', () => {
  const violations: string[] = []
  let checked = 0
  for (const file of views(path.resolve('src'))) {
    const source = readFileSync(file, 'utf8')
    if (!source.includes('<Sheet') && !file.endsWith('tracking-sheet.view.tsx') && !file.endsWith('device-promotions-sheet.view.tsx')) continue
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node: ts.Node, sheet = false, actions = false) {
      // Forms extracted from the modal still own sheet commands.
      if (ts.isFunctionDeclaration(node) && ['EditForm', 'RenameForm', 'TrackingSheet', 'DevicePromotionsSheet'].includes(node.name?.text ?? '')) sheet = true
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const opening = ts.isJsxElement(node) ? node.openingElement : node
        const tag = opening.tagName.getText(ast)
        sheet ||= tag === 'Sheet'
        actions ||= tag === 'SheetActions'
        if (sheet && /^(PrimaryBtn|SecondaryBtn|GhostBtn|DangerBtn|PrimaryAction)$/.test(tag)) {
          // These controls select body values/options rather than commit/dismiss a sheet.
          const option = file.endsWith('administrative-picker.view.tsx')
            || (file.endsWith('current-area-sheet.view.tsx') && opening.getText(ast).includes("t('home.useLocation')"))
            || (file.endsWith('search.view.tsx') && opening.getText(ast).includes("t('home.chooseArea')"))
          if (!option) {
            checked++
            if (!actions) violations.push(`${path.relative(process.cwd(), file)}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`)
          }
        }
      }
      ts.forEachChild(node, child => visit(child, sheet, actions))
    }
    visit(ast)
  }
  expect(checked).toBeGreaterThan(20)
  expect(violations).toEqual([])
})
