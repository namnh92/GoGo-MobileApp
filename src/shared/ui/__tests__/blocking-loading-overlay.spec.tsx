import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { AccessibilityInfo, Keyboard, Platform, StyleSheet as NativeStyles } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { withRepeat } from 'react-native-reanimated'
import '@/shared/i18n'
import { themes } from '../theme'
import { LoadingIndicator } from '../loading-indicator.view'
import { BlockingLoadingOverlay, useSubmitOverlay } from '../blocking-loading-overlay.view'

jest.mock('../loading-indicator.view', () => ({
  LoadingIndicator: jest.fn(jest.requireActual('../loading-indicator.view').LoadingIndicator),
}))

jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock')
  return { ...mock, withRepeat: jest.fn(mock.withRepeat) }
})

describe.each(Object.keys(themes) as (keyof typeof themes)[])('%s blocking loading', name => {
  beforeEach(() => {
    StyleSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    jest.mocked(withRepeat).mockClear()
    jest.mocked(LoadingIndicator).mockClear()
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
    expect(jest.mocked(LoadingIndicator).mock.calls.at(-1)?.[0]).toMatchObject({ variant: 'dark', decorative: true, size: 80 })
    expect(NativeStyles.flatten(screen.getByTestId('loading-indicator').props.style)).toMatchObject({ width: 80, height: 80, transform: [{ translateY: 0 }] })
    const svg = screen.root!.queryAll(node => node.type === (os === 'android' ? 'RNSVGSvgViewAndroid' : 'RNSVGSvgView'))[0]
    expect(svg.props).toMatchObject({ width: 80, height: 80, vbWidth: 400, vbHeight: 320 })
    expect(withRepeat).not.toHaveBeenCalled()
    await fireEvent(modal, 'requestClose')
    await fireEvent(overlay, 'accessibilityEscape')
    expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
    expect(closed).not.toHaveBeenCalled()
    await act(async () => { await view.rerender(<BlockingLoadingOverlay visible={false} onClosed={closed} />) })
    expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('uses the translucent submit role and the solid refresh backing', () => {
    // The Unistyles Jest mock evaluates styles at module load, so load a fresh
    // stylesheet against each palette to exercise the actual dark surfaces.
    jest.isolateModules(() => {
      const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
      unistyles.StyleSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
      const blocking = jest.requireActual<typeof import('../blocking-loading-overlay.style')>('../blocking-loading-overlay.style')
      const refresh = jest.requireActual<typeof import('../refresh-control.style')>('../refresh-control.style')
      expect(blocking.styles.screen.backgroundColor).toBe(themes[name].overlay.submit)
      expect(refresh.styles.indicator.backgroundColor).toBe(themes[name].surface.canvas)
    })
  })
})

it('keeps results hidden until the native submit overlay reports dismissal', async () => {
  const hook = await renderHook<ReturnType<typeof useSubmitOverlay>, { pending: boolean }>(({ pending }) => useSubmitOverlay(pending), { initialProps: { pending: false } })
  expect(hook.result.current.closed).toBe(true)
  await hook.rerender({ pending: true })
  expect(hook.result.current.closed).toBe(false)
  await hook.rerender({ pending: false })
  expect(hook.result.current.closed).toBe(false)
  await act(async () => hook.result.current.onClosed())
  expect(hook.result.current.closed).toBe(true)
  await hook.rerender({ pending: true })
  expect(hook.result.current.closed).toBe(false)
})
