import { render, screen } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'

import '@/shared/i18n'
import { themes } from '@/shared/ui/theme'
import { darkBorder, darkGlass, darkSurface } from '@/shared/ui/tokens'

/**
 * Dark-device defects on PR #421, one test per cause. The unistyles mock
 * resolves every theme-function stylesheet and `useUnistyles` against the first
 * registered theme, so registering only the dark one before the modules load
 * is a dark device. The modules are imported after that, never hoisted above it.
 *
 * - The promotions and tracking sheets kept a static stylesheet with the light
 *   `glassFx.sheet` and `neutral[100]`, so their panel stayed ivory while the
 *   `Text` inside (which reads the theme) turned light.
 * - `theme.glass.bar` was the light bar in both modes: light wash, light blur.
 * - The root layout hard-coded `<StatusBar style="dark">` and a light canvas.
 * - The Profile row dividers were `neutral[100]`, not `border.hairline`.
 */
const mockStatusBar = jest.fn()
jest.mock('expo-status-bar', () => ({ StatusBar: (props: { style: string }) => (mockStatusBar(props), null) }))

UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })

/** The nearest ancestor whose own style paints a background: the panel behind a heading. */
function panelOf(node: { parent: unknown; props: { style?: unknown } }) {
  for (let n = node as { parent: unknown; props: { style?: unknown } } | null; n; n = n.parent as typeof n) {
    if ((StyleSheet.flatten(n.props.style as never) as { backgroundColor?: string } | undefined)?.backgroundColor) return n
  }
  throw new Error('no panel above the heading')
}

const flat = (node: { props: { style?: unknown } }): Record<string, unknown> =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>

describe('modal surfaces on a dark device', () => {
  it('the device promotions sheet panel is the dark card, not ivory', async () => {
    const { DevicePromotionsSheet } = jest.requireActual<typeof import('@/shared/notifications/device-promotions-sheet.view')>('@/shared/notifications/device-promotions-sheet.view')
    await render(
      <DevicePromotionsSheet visible requesting={false} onContinue={jest.fn()} onDecline={jest.fn()} onLater={jest.fn()} />,
    )
    expect(flat(panelOf(screen.getByRole('header'))).backgroundColor).toBe(darkSurface.card)
  })

  it('the tracking sheet panel is the dark card, not ivory', async () => {
    const { TrackingSheet } = jest.requireActual<typeof import('@/shared/consent/tracking-sheet.view')>('@/shared/consent/tracking-sheet.view')
    await render(<TrackingSheet visible variant="app" onAllow={jest.fn()} onDeny={jest.fn()} onLater={jest.fn()} />)
    expect(flat(panelOf(screen.getAllByRole('header')[0]!)).backgroundColor).toBe(darkSurface.card)
  })

  it('the shared Sheet panel and the Dialog card are the dark card', async () => {
    const { Sheet } = jest.requireActual<typeof import('@/shared/ui/sheet.view')>('@/shared/ui/sheet.view')
    const { Dialog } = jest.requireActual<typeof import('@/shared/ui/dialog.view')>('@/shared/ui/dialog.view')
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
    await render(
      <>
        <Sheet visible onClose={jest.fn()} testID="sheet-panel">
          <Text>body</Text>
        </Sheet>
        <Dialog visible title="T" actions={[{ key: 'ok', label: 'OK' }]} onAction={jest.fn()} onDismiss={jest.fn()} />
      </>,
    )
    expect(flat(screen.getByTestId('sheet-panel')).backgroundColor).toBe(darkSurface.card)
    expect(flat(screen.getByRole('header', { name: 'T' }).parent!).backgroundColor).toBe(darkSurface.card)
  })
})

describe('the tab bar on a dark device', () => {
  const realOS = Platform.OS
  afterEach(() => {
    Platform.OS = realOS
  })

  it('carries the dark wash and hairline, and tints the blur dark', async () => {
    Platform.OS = 'ios'
    const { GlassBar } = jest.requireActual<typeof import('@/shared/ui/glass-bar.view')>('@/shared/ui/glass-bar.view')
    await render(<GlassBar testID="bar" />)
    expect(flat(screen.getByTestId('glass-bar-wash')).backgroundColor).toBe(darkGlass.bar.wash)
    expect(flat(screen.getByTestId('bar')).borderTopColor).toBe(darkGlass.bar.hairline)
    const blur = screen.getByTestId('glass-bar-blur').children[0] as unknown as { props: { tint?: string } }
    expect(blur.props.tint).toBe('dark')
  })
})

describe('status bar', () => {
  it('shows light glyphs on a dark theme', async () => {
    const { ThemedStatusBar } = jest.requireActual<typeof import('@/shared/ui/themed-status-bar.view')>('@/shared/ui/themed-status-bar.view')
    await render(<ThemedStatusBar />)
    expect(mockStatusBar).toHaveBeenLastCalledWith(expect.objectContaining({ style: 'light' }))
  })
})

describe('Profile list on a dark device', () => {
  it('row dividers are the dark hairline, and the segment fill is the dark canvas', async () => {
    const { styles } = jest.requireActual<typeof import('@/features/tabs/profile.style')>('@/features/tabs/profile.style')
    expect(styles.settingRow.borderBottomColor).toBe(darkBorder.hairline)
    expect(styles.segmentBtn.backgroundColor).toBe(darkSurface.canvas)
  })
})
