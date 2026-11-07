import { fileURLToPath, URL } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('resolves every contribution declaration and rejects invalid wizard price/rating values', () => {
  const fixture = fileURLToPath(new URL('./fixtures/contribution-contract.ts', import.meta.url))
  const program = ts.createProgram([fixture], {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    types: [],
  })
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => ({
    file: diagnostic.file?.fileName,
    line: diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1
      : undefined,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }))
  expect(diagnostics).toEqual([])
})
