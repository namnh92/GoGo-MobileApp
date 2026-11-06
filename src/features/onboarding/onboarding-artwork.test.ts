import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Static only: importing the manifest here would execute Metro JPEG requires in Node.
const directory = join(__dirname, '../../../assets/images/onboarding')
const source = readFileSync(join(__dirname, 'onboarding-artwork.ts'), 'utf8')
const expected = {
  debate: ['debate-cafe.jpg'],
  swipe: ['swipe-mua-cafe.jpg', 'swipe-oven-trattoria.jpg', 'swipe-workshop-cafe.jpg'],
  plan: ['plan-moc-rieu.jpg', 'plan-gac-cafe.jpg'],
}

// Hashes, dimensions and bytes of the six owner-supplied originals, independently
// mapped from artwork/map.txt (img-1, img-5, img-3, img-4, img-6, img-2).
const originals = [
  ['debate-cafe.jpg', 'f387cd1d1498b5b5f080a2097e19272d4eeb5a37edc80f0aa668dd636cebc26b', 512, 279, 69683],
  ['swipe-mua-cafe.jpg', '71281f3b2c3ddd0116c023b79f42d7437811cae6d1e31903510931479c0f55d8', 237, 512, 49735],
  ['swipe-oven-trattoria.jpg', 'c2c89c7ae9d9b9c1bec93a57823d5764ccd9415a09d44dd54c92d7ce4e94c7b6', 512, 286, 74243],
  ['swipe-workshop-cafe.jpg', 'ccad6fe4ef75f4c928d9d29a8e7e25e3c48fd08209ecaf098d183d3c37484a5f', 512, 279, 74623],
  ['plan-moc-rieu.jpg', '19adcce6f22574c14323b1ec6eb0e2afaa6d2ffeb598cec335d1a63c9297a7d8', 512, 279, 66218],
  ['plan-gac-cafe.jpg', '440f20c2767281b570b0cc37a460784b5e701a5dbc9557417b37c43f414c306c', 237, 512, 53044],
] as const

function jpegDimensions(bytes: Buffer): [number, number] {
  // Walk JPEG segments to a Start Of Frame; no decoder or asset loader required.
  for (let offset = 2; offset < bytes.length;) {
    if (bytes[offset] !== 0xff) throw new Error('Invalid JPEG segment')
    const marker = bytes[offset + 1]
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)]
    }
    const length = bytes.readUInt16BE(offset + 2)
    if (length < 2) throw new Error('Invalid JPEG segment length')
    offset += 2 + length
  }
  throw new Error('Missing JPEG frame')
}

describe('bundled onboarding artwork', () => {
  it('declares the exact grouped mapping through literal Metro requires, without URLs', () => {
    const file = ts.createSourceFile('onboarding-artwork.ts', source, ts.ScriptTarget.Latest, true)
    const mapping: Record<string, string[]> = {}
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'artwork' && node.initializer) {
        let value = node.initializer
        while (ts.isAsExpression(value) || ts.isSatisfiesExpression(value)) value = value.expression
        if (!ts.isObjectLiteralExpression(value)) throw new Error('Artwork must be a literal object')
        for (const property of value.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) throw new Error('Artwork groups must be literal arrays')
          mapping[property.name.getText(file)] = property.initializer.elements.map(element => {
            if (!ts.isCallExpression(element) || element.expression.getText(file) !== 'require' || element.arguments.length !== 1 || !ts.isStringLiteral(element.arguments[0])) {
              throw new Error('Artwork must use literal local require paths')
            }
            const path = element.arguments[0].text
            expect(path.startsWith('../../../assets/images/onboarding/')).toBe(true)
            return path.slice('../../../assets/images/onboarding/'.length)
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    expect(mapping).toEqual(expected)
    expect(source).not.toMatch(/https?:\/\//)
  })

  it.each(originals)('preserves %s byte-for-byte with its JPEG dimensions', (name, hash, width, height, size) => {
    const bytes = readFileSync(join(directory, name))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash)
    expect(bytes.length).toBe(size)
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
    expect(jpegDimensions(bytes)).toEqual([width, height])
  })
})
