import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, Keyboard, Platform, StyleSheet as NativeStyles } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { withRepeat } from 'react-native-reanimated'
import '@/shared/i18n'
import { themes } from '../theme'
import { BlockingLoadingOverlay } from '../blocking-loading-overlay.view'

jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock')
  return { ...mock, withRepeat: jest.fn(mock.withRepeat) }
})

describe.each(['orange', 'orangeDark'] as const)('%s blocking loading', name => {
  beforeEach(() => {
    StyleSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    jest.mocked(withRepeat).mockClear()
  })
  afterEach(() => jest.restoreAllMocks())

  it.each(['ios', 'android'] as const)('blocks dismissal and announces busy on %s, then releases the window', async os => {
    jest.replaceProperty(Platform, 'OS', os)
    const dismiss = jest.spyOn(Keyboard, 'dismiss')
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const closed = jest.fn()
    const view = await render(<BlockingLoadingOverlay visible accessibilityLabel="Signing out" onClosed={closed} />)
    const modal = screen.getByTestId('blocking-loading-modal')
    expect(modal.props).toMatchObject({ visible: true, presentationStyle: 'overFullScreen', allowSwipeDismissal: false, animationType: 'none' })
    expect(dismiss).toHaveBeenCalled()
    await fireEvent(modal, 'show')
    expect(announce).toHaveBeenCalledWith('Signing out')
    const overlay = screen.getByTestId('blocking-loading-overlay')
    expect(overlay.props.accessibilityViewIsModal).toBe(true)
    expect(overlay.props.accessibilityState).toEqual({ busy: true })
    expect(NativeStyles.flatten(screen.getByTestId('loading-indicator').props.style).transform).toEqual([{ translateY: 0 }])
    expect(withRepeat).not.toHaveBeenCalled()
    await fireEvent(modal, 'requestClose')
    await fireEvent(overlay, 'accessibilityEscape')
    expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
    expect(closed).not.toHaveBeenCalled()
    await act(async () => { await view.rerender(<BlockingLoadingOverlay visible={false} onClosed={closed} />) })
    expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('uses the theme canvas for the blocking window and refresh mark backing', () => {
    // The Unistyles Jest mock evaluates styles at module load, so load a fresh
    // stylesheet against each palette to exercise the actual dark surfaces.
    jest.isolateModules(() => {
      const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
      unistyles.StyleSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
      const blocking = jest.requireActual<typeof import('../blocking-loading-overlay.style')>('../blocking-loading-overlay.style')
      const refresh = jest.requireActual<typeof import('../refresh-control.style')>('../refresh-control.style')
      expect(blocking.styles.screen.backgroundColor).toBe(themes[name].surface.canvas)
      expect(refresh.styles.indicator.backgroundColor).toBe(themes[name].surface.canvas)
    })
  })
})
