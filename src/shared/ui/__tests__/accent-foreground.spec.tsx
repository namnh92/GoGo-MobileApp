jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.mock('@/features/assistant/assistant-entry', () => ({ FAB_SIZE: 56 }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useTaxonomies: () => ({ data: { kinds: {} }, isPending: false, isError: false }),
  useUpdateProfile: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: { datasetVersion: 'v1' }, isPending: false, isError: false }),
  useAdministrativeUnits: () => ({ data: [], isPending: false, isError: false }),
}))

import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'

import { Icon, IconCheck } from '../icons'
import { Text, resolveColor } from '../text'
import { themes, themeName, type AppTheme, type ThemeName } from '../theme'
import '@/shared/i18n'
import type { Me } from '@/shared/api'
import { onAccent } from '../tokens'

// The stock mock evaluates styles once in orange. Keep the real style
// factories, but evaluate their properties in the current test theme too.
// This proves the fill/foreground pair; it cannot prove native switching.
let currentName: ThemeName = 'orange'
let currentTheme: AppTheme = themes.orange
// Spy on the exported module, not Babel's copied namespace object.
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: { ...runtime, themeName: currentName } }))
jest.spyOn(unistyles, 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => {
  const evaluate = () => typeof factory === 'function' ? factory(currentTheme, unistyles.useUnistyles().rt) : factory
  return new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
    get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(evaluate(), key),
  })
})
// Load after installing the factory adapter above.
const { PrimaryBtn } = jest.requireActual<typeof import('../button.view')>('../button.view')
const { AvatarCircle, Chip } = jest.requireActual<typeof import('../primitives')>('../primitives')
const { AssistantFab } = jest.requireActual<typeof import('@/features/assistant/assistant-fab.view')>('@/features/assistant/assistant-fab.view')
const { ThemeAccentCard } = jest.requireActual<typeof import('@/features/account/theme-accent.view')>('@/features/account/theme-accent.view')
const { ProfileDefaultsCard } = jest.requireActual<typeof import('@/features/account/profile-defaults.view')>('@/features/account/profile-defaults.view')

type HostNode = { props: Record<string, unknown>; children?: (HostNode | string)[] }
function fills(node: HostNode): unknown[] {
  return [node.props.fill, ...(node.children ?? []).flatMap(child => typeof child === 'string' ? [] : fills(child))]
}
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as StyleProp<ViewStyle & TextStyle>) ?? {}
function descendants(node: HostNode): HostNode[] {
  return [node, ...(node.children ?? []).flatMap(child => typeof child === 'string' ? [] : descendants(child))]
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(foreground: string, background: string) {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (hi! + 0.05) / (lo! + 0.05)
}

// The stock Unistyles mock always serves orange. Supply each real theme to
// exercise foreground resolution; this does not simulate native theme updates.
describe.each(Object.entries(themes))('%s accent foreground', (_name, theme) => {
  beforeEach(() => {
    currentName = _name as ThemeName
    currentTheme = theme
  })

  it('supplies readable text, SVG strokes, material icons and loading indicators on accent fills', async () => {
    const foreground = resolveColor(theme, 'accent.onAccent')
    expect(foreground).toBe(onAccent)
    expect(foreground).toMatch(/^#[0-9A-F]{6}$/i)
    for (const fill of [theme.accent.primary, theme.accent.pressed]) {
      expect(contrast(foreground, fill)).toBeGreaterThanOrEqual(4.5)
    }

    const view = await render(<>
      <Text color="accent.onAccent">Preview action</Text>
      <Icon name="arrowRight" color="accent.onAccent" />
      <IconCheck color={theme.accent.onAccent} />
      <PrimaryBtn variant="pill" label="Apply theme" leadingIcon="checkCircle" onPress={jest.fn()} />
      <PrimaryBtn variant="pill" label="Open system settings" leadingIcon="external" onPress={jest.fn()} />
    </>)
    for (const label of ['Preview action', 'Apply theme', 'Open system settings']) {
      expect(StyleSheet.flatten(screen.getByText(label).props.style).color).toBe(foreground)
    }
    for (const glyph of ['icon-arrow-right', 'icon-check']) {
      expect(screen.getByTestId(glyph).props.stroke).toBe(foreground)
    }
    for (const glyph of ['material-icon-checkCircle', 'material-icon-external']) {
      const node = screen.getByTestId(glyph, { includeHiddenElements: true })
      expect(fills(node as unknown as HostNode)).toContainEqual({ type: 0, payload: processColor(foreground) })
    }

    await view.rerender(<PrimaryBtn variant="pill" label="Apply theme" loading onPress={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByText('Apply theme').props.style).color).toBe(foreground)
    expect(screen.getByTestId('button-spinner').props.color).toBe(foreground)
  })

  it('uses onAccent on the actual primary/save buttons, avatar, FAB, selected chip and Theme controls', async () => {
    // A distinct probe proves the semantic role is used: text.inverse and
    // redesign.white otherwise happen to have the same value in every theme.
    const foreground = '#FEFEFE'
    currentTheme = { ...theme, accent: { ...theme.accent, onAccent: foreground as typeof theme.accent.onAccent } }
    const view = await render(<>
      <PrimaryBtn variant="pill" label="Lưu thiết lập mặc định" leadingIcon="save" onPress={jest.fn()} />
      <PrimaryBtn variant="area" label="Confirm area" leadingIcon="checkCircle" onPress={jest.fn()} />
      <AvatarCircle label="M" />
      <AssistantFab extended isNew={false} onPress={jest.fn()} />
      <Chip label="Selected" variant="selected" icon="check" />
      <ThemeAccentCard />
    </>)
    for (const label of ['Lưu thiết lập mặc định', 'Confirm area', 'M', 'Hỏi GoGo AI', 'Selected', 'Nút hành động chính']) {
      const node = screen.getByText(label)
      expect(flat(node).color).toBe(foreground)
      let parent = node.parent
      while (parent && !flat(parent).backgroundColor) parent = parent.parent
      const fill = parent && flat(parent).backgroundColor
      expect(typeof fill).toBe('string')
      expect(contrast(foreground, fill as string)).toBeGreaterThanOrEqual(4.5)
    }
    const areaIcon = within(screen.getByRole('button', { name: 'Confirm area' })).getByTestId('material-icon-checkCircle', { includeHiddenElements: true })
    expect(fills(areaIcon as unknown as HostNode)).toContainEqual({ type: 0, payload: processColor(foreground) })
    expect(screen.getByTestId('icon-arrow-right').props.stroke).toBe(foreground)
    expect(screen.getByText('Selected').parent!.queryAll(node => node.props.testID === 'icon-check')).toHaveLength(0)
    expect(flat(screen.getByRole('button', { name: 'Lưu thiết lập mặc định' })).backgroundColor).toBe(theme.accent.primary)
    expect(flat(screen.getByTestId('assistant-fab')).backgroundColor).toBe(theme.accent.primary)
    const inverted = screen.getByTestId('assistant-glyph-inverted')
    expect(fills(inverted as unknown as HostNode)).toContainEqual({ type: 0, payload: processColor(foreground) })
    for (const accent of ['orange', 'green', 'blue', 'purple'] as const) {
      const swatch = screen.getByTestId(`theme-swatch-${accent}`)
      const disc = descendants(swatch as unknown as HostNode).find(node => flat(node).width === 48)!
      expect(flat(disc).backgroundColor).toBe(themes[themeName(accent, theme.mode)].accent.primary)
    }
    await view.unmount()
  })

  it('keeps the Defaults save bar readable when a budget edit enables it', async () => {
    const foreground = '#FEFEFE'
    currentTheme = { ...theme, accent: { ...theme.accent, onAccent: foreground as typeof theme.accent.onAccent } }
    const profile = { actorType: 'user', id: 'u1', displayName: 'M', interests: { mood: [] } } as Me
    await render(<ProfileDefaultsCard profile={profile} page />)
    const save = () => screen.getByRole('button', { name: 'Lưu thiết lập mặc định' })
    expect(save().props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(screen.getByRole('radio', { name: '300–500k' }))
    expect(save().props.accessibilityState.disabled).toBe(false)
    expect(flat(save()).backgroundColor).toBe(theme.accent.primary)
    expect(flat(screen.getByText('Lưu thiết lập mặc định')).color).toBe(foreground)
    const icon = within(save()).getByTestId('material-icon-save', { includeHiddenElements: true })
    expect(fills(icon as unknown as HostNode)).toContainEqual({ type: 0, payload: processColor(foreground) })
    expect(contrast(foreground, flat(save()).backgroundColor as string)).toBeGreaterThanOrEqual(4.5)
  })
})
