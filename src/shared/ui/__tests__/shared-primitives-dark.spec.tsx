jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
import { render, screen } from '@testing-library/react-native'
import { Image, type ImageProps } from 'expo-image'
import { Text as RNText, StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'

import '@/shared/i18n'
import { themes } from '@/shared/ui/theme'
import { darkBorder, darkStatus, darkSurface, mapColors } from '@/shared/ui/tokens'

// Observe the public Expo Image props, before native source/transition normalization.
jest.mock('expo-image', () => ({ Image: jest.fn((_props: ImageProps) => null) }))

/**
 * Group 01 (shared primitives) on a dark device. The unistyles mock resolves
 * every theme-function stylesheet against the first registered theme, so
 * registering only the dark one before the modules load is a dark device. A
 * static stylesheet cannot follow it: each assertion here failed while the
 * shared component still read a light token at import.
 */
UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })

const flat = (style: unknown): Record<string, unknown> => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>

describe('shared primitives on a dark device', () => {
  it('glassStyles card and strong are the dark card with the dark hairline', () => {
    const { glassStyles } = jest.requireActual<typeof import('@/shared/ui/primitives')>('@/shared/ui/primitives')
    for (const look of [glassStyles.card, glassStyles.strong]) {
      expect(flat(look).backgroundColor).toBe(darkSurface.card)
      expect(flat(look).borderColor).toBe(darkBorder.hairline)
    }
  })

  it('the image placeholder behind a remote photo is the dark subtle surface', async () => {
    const { RemoteImage } = jest.requireActual<typeof import('@/shared/ui/primitives')>('@/shared/ui/primitives')
    jest.mocked(Image).mockClear()
    await render(<RemoteImage uri="https://example.test/a.jpg" style={{ width: 4, height: 4 }} />)
    const [props] = jest.mocked(Image).mock.calls[0]
    expect(props.source).toEqual({ uri: 'https://example.test/a.jpg' })
    expect(props.contentFit).toBe('cover')
    expect(props.transition).toBe(150)
    expect(flat(props.style)).toMatchObject({ backgroundColor: darkSurface.subtle, width: 4, height: 4 })
  })

  it('passes a bundled illustration source directly with contain, no transition and the dark placeholder', async () => {
    const { RemoteImage } = jest.requireActual<typeof import('@/shared/ui/primitives')>('@/shared/ui/primitives')
    jest.mocked(Image).mockClear()
    await render(<RemoteImage source={106} illustration style={{ width: 4, height: 4 }} />)
    const [props] = jest.mocked(Image).mock.calls[0]
    expect(props.source).toBe(106)
    expect(props.contentFit).toBe('contain')
    expect(props.transition).toBe(0)
    expect(flat(props.style)).toMatchObject({ backgroundColor: themes.orangeDark.redesign.low, width: 4, height: 4 })
  })

  it('the AppHeader canvas follows the dark device', async () => {
    const { AppHeader } = jest.requireActual<typeof import('@/shared/ui/app-header.view')>('@/shared/ui/app-header.view')
    await render(<AppHeader title="T" onBack={jest.fn()} />)
    expect(flat(screen.getByTestId('app-header').props.style).backgroundColor).toBe(themes.orangeDark.redesign.canvas)
  })

  it('the map fallback surface is not the light map green', async () => {
    const { MapCanvas } = jest.requireActual<typeof import('@/shared/ui/map-canvas.view')>('@/shared/ui/map-canvas.view')
    await render(<MapCanvas pins={[]} fallback={<RNText testID="fb">x</RNText>} />)
    expect(flat(screen.getByTestId('fb').parent!.props.style).backgroundColor).not.toBe(mapColors.canvas)
  })

  it('the stale notice bar is the dark warning surface', () => {
    const { styles } = jest.requireActual<typeof import('@/shared/ui/async-state.style')>('@/shared/ui/async-state.style')
    expect(styles.staleBar.backgroundColor).toBe(darkStatus.warningSoft)
  })

  it('the skeleton block is the dark subtle surface', () => {
    const { styles } = jest.requireActual<typeof import('@/shared/ui/skeleton.style')>('@/shared/ui/skeleton.style')
    expect(styles.block.backgroundColor).toBe(darkSurface.subtle)
  })

  it('the place-card save toggle is the dark card', () => {
    const { styles } = jest.requireActual<typeof import('@/shared/ui/place-card.style')>('@/shared/ui/place-card.style')
    const toggle = Object.values(styles).find(s => (s as { borderRadius?: number }).borderRadius === 22 && (s as { width?: number }).width === 44)
    expect((toggle as { backgroundColor: string }).backgroundColor).toBe(darkSurface.card)
  })
})
