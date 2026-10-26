/**
 * The assistant's markdown-light answer text (contract `AssistantMessage.text`:
 * paragraphs, lists, `[n]` citation markers) as blocks the thread can draw
 * with the design system's pieces — lead sentence, `MessageList`, `Cite` —
 * instead of a markdown renderer (GoGo-MobileApp#378). Anything else in the
 * text stays plain text; nothing is interpreted as a link or HTML.
 */

export type Inline = { kind: 'text'; text: string; bold: boolean } | { kind: 'cite'; n: number }

export type AnswerBlock =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }

const ORDERED = /^\s*\d+[.)]\s+/
const BULLET = /^\s*[-*•]\s+/

/** `**bold**` and `[n]` inside one line. An unclosed `**` stays as typed. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = []
  const push = (text: string, bold: boolean) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.kind === 'text' && last.bold === bold) last.text += text
    else out.push({ kind: 'text', text, bold })
  }
  const pattern = /\*\*([^*]+)\*\*|\[(\d{1,2})\]/g
  let at = 0
  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    push(line.slice(at, match.index), false)
    if (match[1] !== undefined) push(match[1], true)
    else out.push({ kind: 'cite', n: Number(match[2]) })
    at = match.index + match[0].length
  }
  push(line.slice(at), false)
  return out
}

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', inlines: parseInline(paragraph.join(' ')) })
    paragraph = []
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const ordered = ORDERED.test(line)
    const bullet = !ordered && BULLET.test(line)
    if (ordered || bullet) {
      flush()
      const item = parseInline(line.replace(ordered ? ORDERED : BULLET, ''))
      const last = blocks[blocks.length - 1]
      if (last && last.kind === 'list' && last.ordered === ordered) last.items.push(item)
      else blocks.push({ kind: 'list', ordered, items: [item] })
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    paragraph.push(line.trim())
  }
  flush()
  return blocks
}

/** The text a screen reader reads for a reply: markers and asterisks removed. */
export function plainAnswer(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\[(\d{1,2})\]/g, '').replace(/\s+/g, ' ').trim()
}
