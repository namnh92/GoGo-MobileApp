import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? entry.name === '__tests__' ? [] : sources(join(dir, entry.name))
    : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : [])
}

it('every image uses memory-disk caching and no source disables caching', () => {
  const failures: string[] = []
  for (const path of sources(join(process.cwd(), 'src'))) {
    const source = readFileSync(path, 'utf8')
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'react-native'
        && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
        && node.importClause.namedBindings.elements.some(item => ['Image', 'ImageBackground'].includes((item.propertyName ?? item.name).text))) {
        failures.push(`${path}: use expo-image for cached images`)
      }
      if (ts.isJsxAttribute(node) && node.name.getText(file) === 'cachePolicy'
        && node.initializer?.getText(file).includes('none')) failures.push(`${path}: disabled cache`)
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === 'Image') {
        const policy = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(file) === 'cachePolicy')
        if (!policy || !ts.isJsxAttribute(policy) || !policy.initializer || !ts.isStringLiteral(policy.initializer) || policy.initializer.text !== 'memory-disk') {
          failures.push(`${path}: Image must explicitly use memory-disk`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
  expect(failures).toEqual([])
})
