import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../..')
// Only these production primitives may render RN text. Tests probe/mock native hosts.
const allowed: Record<string, string[]> = {
  'shared/ui/text.tsx': ['Text'],
  'shared/ui/text-input.tsx': ['TextInput'],
}
const restricted = new Set(['Text', 'TextInput', 'Button'])

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name)
    if (entry.name === '__tests__' || /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(name)) return []
    return entry.isDirectory() ? files(name) : /\.[cm]?[jt]sx?$/.test(name) ? [name] : []
  })
}

function violations(source: string, name: string): string[] {
  const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const report = (node: ts.Node) => found.push(`${name}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
  const check = (module: string, names: string[], node: ts.Node) => {
    if (module.startsWith('react-native/')) {
      if (/\/(?:Text|TextInput|Button)(?:\/|$)/.test(module)) report(node)
    } else if (module === 'react-native' && names.some(value => value === '*' || (restricted.has(value) && !allowed[name]?.includes(value)))) report(node)
  }
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      const names = bindings && ts.isNamedImports(bindings)
        ? bindings.elements.filter(item => !item.isTypeOnly).map(item => item.propertyName?.text ?? item.name.text)
        : bindings ? ['*'] : []
      if (clause?.name) names.push('*')
      check(node.moduleSpecifier.text, names, node)
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      const names = node.exportClause && ts.isNamedExports(node.exportClause)
        ? node.exportClause.elements.filter(item => !item.isTypeOnly).map(item => item.propertyName?.text ?? item.name.text) : ['*']
      check(node.moduleSpecifier.text, names, node)
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const module = node.arguments[0]
      if (module && ts.isStringLiteral(module)) check(module.text, ['*'], node)
    }
    if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)) {
      const module = node.moduleReference.expression
      if (module && ts.isStringLiteral(module)) check(module.text, ['*'], node)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return found
}

it('all production src text/input imports pass through fixed-font primitives (including aliases and deep imports)', () => {
  expect(files(root).flatMap(file => violations(readFileSync(file, 'utf8'), path.relative(root, file).split(path.sep).join('/')))).toEqual([])
})

it.each([
  "import { Text as Label } from 'react-native'",
  "import { TextInput } from 'react-native'",
  "import { Button } from 'react-native'",
  "import * as RN from 'react-native'",
  "import RN from 'react-native'",
  "export { Text } from 'react-native'",
  "const RN = require('react-native')",
  "const RN = import('react-native')",
  "import Input from 'react-native/Libraries/Components/TextInput/TextInput'",
])('rejects a new bypass: %s', source => {
  expect(violations(source, 'features/example.tsx')).toHaveLength(1)
})
