import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { themes } from '../theme'
import { darkStatus, darkText } from '../tokens'

const source = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8')
const checklist = source('password-requirements.view.tsx')
const badge = source('badge.view.tsx')
const badgeStyle = source('badge.style.tsx')
// Read the actual JSX/style bindings, so arithmetic cannot pass against an unused role.
const unmetRoles = [...checklist.matchAll(/color=\{met \? 'status.successText' : 'text.(\w+)'\}/g)].map(match => match[1])
const badgeRole = /stitchGreen:\s*\{\s*backgroundColor: theme.status.(\w+)/.exec(badgeStyle)![1]
function contrast(a: string, b: string) {
  const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe.each(Object.entries(themes))('%s actual redesign pairs', (_name, theme) => {
  it('visible header divider reaches 3:1 against the actual header canvas', () => {
    const header = source('app-header.style.tsx')
    expect(header).toContain('backgroundColor: theme.surface.canvas')
    expect(header).toContain('brandDivider: { width: 1, height: spacing[5], backgroundColor: theme.border.outline }')
    expect(theme.border.outline).toBe(theme.mode === 'dark' ? '#999999' : '#8E706A')
    expect(contrast(theme.border.outline, theme.surface.canvas)).toBeGreaterThanOrEqual(3)
  })
  it('unmet checklist foreground/canvas reaches AA', () => {
    expect(unmetRoles).toHaveLength(2)
    for (const role of unmetRoles) {
      const foreground = theme.text[role as keyof typeof theme.text]
      expect(contrast(foreground, theme.surface.canvas)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('white/recommendation fill reaches AA', () => {
    expect(contrast(theme.text.inverse, theme.status[badgeRole as keyof typeof theme.status])).toBeGreaterThanOrEqual(4.5)
  })
  it('keeps general outline/success roles unchanged', () => {
    expect(theme.border.outline).toBe(theme.mode === 'dark' ? darkText.tertiary : '#8E706A')
    expect(theme.status.success).toBe(theme.mode === 'dark' ? darkStatus.success : '#237C51')
    expect(theme.status.successText).toBe(theme.mode === 'dark' ? darkStatus.successText : '#00623C')
  })
})

it('binds both checklist props to the scoped TextColor resolver without reducing opacity', () => {
  expect(checklist).toMatch(/<MaterialIcon[^>]+color=\{met \? 'status.successText' : 'text.supporting'\}/)
  expect(checklist).toMatch(/<Text[^>]+color=\{met \? 'status.successText' : 'text.supporting'\}/)
  expect(source('text.tsx')).toMatch(/'text.supporting': theme => theme.text.supporting/)
  expect(source('text.tsx')).toContain('COLOR[color](theme)')
  expect(checklist + source('password-requirements.style.tsx')).not.toMatch(/opacity/)
})
it('binds the scoped opaque recommendation fill to white label/icon', () => {
  expect(badgeStyle).toMatch(/stitchGreen: \{ backgroundColor: theme.status.successFill,/)
  expect(badge).toMatch(/<MaterialIcon[^>]+appearance === 'stitchGreen' \? 'text.inverse'/)
  expect(badge).toMatch(/<Text[^>]+appearance === 'stitchGreen' \? 'text.inverse'/)
  expect(source('text.tsx')).toMatch(/'text.inverse': theme => theme.text.inverse/)
  expect(badge + badgeStyle).not.toMatch(/opacity/)
})
