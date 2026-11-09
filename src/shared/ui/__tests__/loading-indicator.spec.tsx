import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, RefreshControl, StyleSheet, View } from 'react-native'
import { cancelAnimation, useAnimatedProps, withRepeat } from 'react-native-reanimated'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import '@/shared/i18n'
import { themes } from '../theme'
import { loadingIndicator as token } from '../tokens'
import { LoadingIndicator } from '../loading-indicator.view'
import { PrimaryBtn } from '../button.view'
import { RefreshIndicatorHeader, ThemedRefreshControl } from '../refresh-control.view'

jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock')
  return { ...mock, withRepeat: jest.fn(mock.withRepeat), cancelAnimation: jest.fn(mock.cancelAnimation), useAnimatedProps: jest.fn(mock.useAnimatedProps) }
})

afterEach(() => jest.restoreAllMocks())

describe.each(['orange', 'orangeDark'] as const)('%s loading', name => {
  beforeEach(() => {
    UnistylesSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    jest.mocked(withRepeat).mockClear()
    jest.mocked(cancelAnimation).mockClear()
  })

  it.each(['light', 'dark', 'brand'] as const)('preserves the SVG spectrum and crossover on %s backgrounds', async variant => {
    await render(<LoadingIndicator variant={variant} />)
    expect(StyleSheet.flatten(screen.getByTestId('loading-indicator').props.style)).toMatchObject({ width: 48, height: 48, transform: [{ translateY: 0 }] })
    expect(screen.getByRole('progressbar').props.accessibilityState.busy).toBe(true)
    const gradients = screen.root!.queryAll(node => node.type === 'RNSVGLinearGradient')
    expect(gradients).toHaveLength(2)
    expect(gradients[0].props.children.map((stop: { props: { stopColor: string } }) => stop.props.stopColor)).toEqual(token.spectrum)
    expect(gradients[1].props.children.map((stop: { props: { stopColor: string } }) => stop.props.stopColor)).toEqual(token.bridge)
    expect(screen.root!.queryAll(node => node.type === 'RNSVGPath').some(path => path.props.d === 'M 21.2,28.3 C 22.8,25.6 25,22.4 26.8,19.7' && path.props.strokeWidth === 5.5)).toBe(true)
    expect(withRepeat).not.toHaveBeenCalled()
  })

  it('keeps the busy button labelled and blocks duplicate submissions', async () => {
    const submit = jest.fn()
    await render(<PrimaryBtn label="Submit" onPress={submit} loading disabled />)
    expect(screen.getByTestId('button-spinner-beam')).toBeTruthy()
    expect(screen.getByText('Submit')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true })
    await fireEvent.press(button)
    expect(submit).not.toHaveBeenCalled()
    // The button announces busy once; its decorative mark adds no second status.
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('tints the native refresh control and removes the branded header when finished', async () => {
    const refresh = jest.fn()
    const view = await render(<View><ThemedRefreshControl refreshing onRefresh={refresh} /><RefreshIndicatorHeader refreshing /></View>)
    // RN's official mock renders an empty host, but retains the real props.
    const native = (RefreshControl as unknown as { latestRef: { props: import('react-native').RefreshControlProps } }).latestRef
    expect(native.props.tintColor).toBe(themes[name].accent.primary)
    expect(native.props.colors).toEqual([themes[name].accent.primary])
    expect(native.props.progressBackgroundColor).toBe(themes[name].surface.card)
    await act(async () => native.props.onRefresh?.())
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('refresh-loading-indicator')).toBeTruthy()
    await view.rerender(<RefreshIndicatorHeader refreshing={false} />)
    expect(screen.queryByTestId('refresh-loading-indicator')).toBeNull()
  })

  it('waits for the OS, starts the loop, then cancels to a static mark when Reduce Motion changes', async () => {
    let answer!: (value: boolean) => void
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(resolve => { answer = resolve }))
    const listen = jest.spyOn(AccessibilityInfo, 'addEventListener')
    listen.mockClear()
    const view = await render(<LoadingIndicator />)
    expect(withRepeat).not.toHaveBeenCalled()
    await act(async () => answer(false))
    expect(withRepeat).toHaveBeenCalledTimes(2)
    const handler = (listen.mock.calls as unknown as [string, (value: boolean) => void][]).find(([event]) => event === 'reduceMotionChanged')![1]
    jest.mocked(withRepeat).mockClear()
    jest.mocked(cancelAnimation).mockClear()
    await act(async () => handler(true))
    expect(cancelAnimation).toHaveBeenCalled()
    expect(withRepeat).not.toHaveBeenCalled()
    expect(StyleSheet.flatten(screen.getByTestId('loading-indicator').props.style).transform).toEqual([{ translateY: 0 }])
    expect(jest.mocked(useAnimatedProps).mock.results.at(-1)!.value).toEqual({ strokeDashoffset: 0 })
    await view.unmount()
  })
})
