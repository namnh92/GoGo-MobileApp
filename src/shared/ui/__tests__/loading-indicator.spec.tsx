import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, Platform, RefreshControl, StyleSheet, ScrollView } from 'react-native'
import { cancelAnimation, useAnimatedProps, withRepeat } from 'react-native-reanimated'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import '@/shared/i18n'
import { themes } from '../theme'
import { brandLogo, loadingIndicator as token } from '../tokens'
import { logoPaths } from '../gogo-logo.asset'
import { LoadingIndicator } from '../loading-indicator.view'
import { PrimaryBtn } from '../button.view'
import { PullToRefresh } from '../refresh-control.view'

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

  it.each(['light', 'dark', 'brand'] as const)('preserves the option A ribbon and beam on %s backgrounds', async variant => {
    await render(<LoadingIndicator variant={variant} />)
    expect(StyleSheet.flatten(screen.getByTestId('loading-indicator').props.style)).toMatchObject({ width: 48, height: 48, transform: [{ translateY: 0 }] })
    expect(screen.getByRole('progressbar').props.accessibilityState.busy).toBe(true)
    const gradients = screen.root!.queryAll(node => node.type === 'RNSVGLinearGradient')
    expect(gradients).toHaveLength(2)
    expect(gradients[0].props.children.map((stop: { props: { stopColor: string } }) => stop.props.stopColor)).toEqual(brandLogo.spectrum.map(([, color]) => color))
    const beam = screen.getByTestId('loading-indicator-beam')
    expect(beam.props.d).toBe(logoPaths.ribbon.replace(/ Z$/, ''))
    expect(beam.props.stroke).toEqual({ type: 0, payload: 0xffffffff })
    expect(beam.props.strokeWidth).toBe(7)
    expect(beam.props.strokeDasharray.map(Number)).toEqual([85, 255])
    expect(withRepeat).not.toHaveBeenCalled()
    expect(jest.mocked(useAnimatedProps).mock.results.map(result => result.value)).toContainEqual({ opacity: 0.9, matrix: [1, 0, 0, 1, 0, 0] })
  })

  it('keeps the busy button labelled and blocks duplicate submissions', async () => {
    const submit = jest.fn()
    await render(<PrimaryBtn label="Submit" onPress={submit} loading disabled />)
    expect(screen.getByTestId('button-spinner-beam')).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('button-spinner').props.style)).toMatchObject({ width: 24, height: 24 })
    expect(screen.getByText('Submit')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true })
    await fireEvent.press(button)
    expect(submit).not.toHaveBeenCalled()
    // The button announces busy once; its decorative mark adds no second status.
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it.each([['ios', 'resolve'], ['ios', 'reject'], ['android', 'resolve'], ['android', 'reject']] as const)('hides native refresh artwork on %s, guards duplicate pulls and clears on %s', async (os, outcome) => {
    jest.replaceProperty(Platform, 'OS', os)
    let finish!: () => void
    let fail!: (error: Error) => void
    const refresh = jest.fn(() => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject }))
    await render(<PullToRefresh onRefresh={refresh}><ScrollView testID="list" /></PullToRefresh>)
    const control = () => screen.getByTestId('list').props.refreshControl
    const native = (RefreshControl as unknown as { latestRef: { props: import('react-native').RefreshControlProps } }).latestRef
    expect(native.props.tintColor).toBe('transparent')
    expect(native.props.colors).toEqual(['transparent'])
    expect(native.props.progressBackgroundColor).toBe('transparent')
    if (os === 'ios') expect(StyleSheet.flatten(control().props.style)).toMatchObject({ opacity: 0 })
    else {
      expect(control().props.style).toBeUndefined()
      expect(native.props.progressViewOffset).toBeLessThan(-token.size)
    }
    expect(screen.getByTestId('list').props.alwaysBounceVertical).toBe(true)
    await act(async () => { control().props.onRefresh(); control().props.onRefresh() })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(control().props.refreshing).toBe(true)
    expect(StyleSheet.flatten(screen.getByTestId('refresh-loading-indicator').props.style)).toMatchObject({ width: 48, height: 48 })
    await act(async () => { if (outcome === 'resolve') finish(); else fail(new Error('offline')) })
    expect(control().props.refreshing).toBe(false)
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
    expect(withRepeat).toHaveBeenCalledTimes(4)
    const handler = (listen.mock.calls as unknown as [string, (value: boolean) => void][]).find(([event]) => event === 'reduceMotionChanged')![1]
    jest.mocked(withRepeat).mockClear()
    jest.mocked(cancelAnimation).mockClear()
    await act(async () => handler(true))
    expect(cancelAnimation).toHaveBeenCalled()
    expect(withRepeat).not.toHaveBeenCalled()
    expect(StyleSheet.flatten(screen.getByTestId('loading-indicator').props.style).transform).toEqual([{ translateY: 0 }])
    expect(jest.mocked(useAnimatedProps).mock.results.map(result => result.value)).toContainEqual({ strokeDashoffset: 0 })
    await view.unmount()
  })
})
