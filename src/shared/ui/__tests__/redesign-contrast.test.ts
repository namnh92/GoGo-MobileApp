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
const unmetRoles = [...checklist.matchAll(/color=\{met \? 'redesign.greenText' : 'redesign.(\w+)'\}/g)].map(match => match[1])
const badgeRole = /stitchGreen:\s*\{\s*backgroundColor: theme.redesign.(\w+)/.exec(badgeStyle)![1]
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
    expect(header).toContain('brandDivider: { width: 1, height: spacing[5], backgroundColor: theme.border.strong }')
    expect(theme.border.strong).toBe(theme.redesign.outline)
    expect(contrast(theme.border.strong, theme.surface.canvas)).toBeGreaterThanOrEqual(3)
  })
  it('unmet checklist foreground/canvas reaches AA', () => {
    expect(unmetRoles).toHaveLength(2)
    for (const role of unmetRoles) {
      const foreground = theme.redesign[role as keyof typeof theme.redesign]
      expect(contrast(foreground, theme.redesign.canvas)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('white/recommendation fill reaches AA', () => {
    expect(contrast(theme.redesign.white, theme.redesign[badgeRole as keyof typeof theme.redesign])).toBeGreaterThanOrEqual(4.5)
  })
  it('keeps general outline/success roles unchanged', () => {
    expect(theme.redesign.outline).toBe(theme.mode === 'dark' ? darkText.tertiary : '#8E706A')
    expect(theme.redesign.green).toBe(theme.mode === 'dark' ? darkStatus.success : '#237C51')
    expect(theme.redesign.greenText).toBe(theme.mode === 'dark' ? darkStatus.successText : '#00623C')
  })
})

it('binds both checklist props to the scoped TextColor resolver without reducing opacity', () => {
  expect(checklist).toMatch(/<MaterialIcon[^>]+color=\{met \? 'redesign.greenText' : 'redesign.checklistUnmet'\}/)
  expect(checklist).toMatch(/<Text[^>]+color=\{met \? 'redesign.greenText' : 'redesign.checklistUnmet'\}/)
  expect(source('text.tsx')).toMatch(/'redesign.checklistUnmet': theme => theme.redesign.checklistUnmet/)
  expect(source('text.tsx')).toContain('COLOR[color](theme)')
  expect(checklist + source('password-requirements.style.tsx')).not.toMatch(/opacity/)
})
it('binds the scoped opaque recommendation fill to white label/icon', () => {
  expect(badgeStyle).toMatch(/stitchGreen: \{ backgroundColor: theme.redesign.recommendationFill,/)
  expect(badge).toMatch(/<MaterialIcon[^>]+appearance === 'stitchGreen' \? 'redesign.white'/)
  expect(badge).toMatch(/<Text[^>]+appearance === 'stitchGreen' \? 'redesign.white'/)
  expect(source('text.tsx')).toMatch(/'redesign.white': theme => theme.redesign.white/)
  expect(badge + badgeStyle).not.toMatch(/opacity/)
})
