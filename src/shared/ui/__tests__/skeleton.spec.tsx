import { render, act } from '@testing-library/react-native'
import { Animated, AccessibilityInfo, StyleSheet as NativeStyles } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { themes } from '../theme'
import { Skeleton, PlaceCardSkeleton } from '../skeleton.view'

it.each(['orange', 'orangeDark'] as const)('uses %s surface tokens', name => {
  // The Unistyles Jest adapter resolves styles at import time.
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolate the import-time theme adapter
    const sheet = require('react-native-unistyles').StyleSheet as typeof StyleSheet
    sheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- evaluate against the isolated theme
    const { styles } = require('../skeleton.style') as typeof import('../skeleton.style')
    expect(styles.block.backgroundColor).toBe(themes[name].surface.subtle)
  })
})

it('stays static with reduced motion', async () => {
  const preference = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  const loop = jest.spyOn(Animated, 'loop')
  try {
    const view = await render(<Skeleton width="70%" height={20} />)
    expect(loop).not.toHaveBeenCalled()
    await view.unmount()
  } finally { preference.mockRestore(); loop.mockRestore() }
})

it('waits for the OS before pulsing and stops on unmount', async () => {
  let answer!: (value: boolean) => void
  const preference = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => new Promise(resolve => { answer = resolve }))
  const start = jest.fn(), stop = jest.fn()
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() })
  try {
    const view = await render(<Skeleton />)
    expect(start).not.toHaveBeenCalled()
    await act(async () => { answer(false) })
    expect(start).toHaveBeenCalledTimes(1)
    await view.unmount()
    expect(stop).toHaveBeenCalledTimes(1)
  } finally { preference.mockRestore(); loop.mockRestore() }
})

it('keeps the place photo at the same 16:10 ratio as the loaded large card', async () => {
  const preference = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  const view = await render(<PlaceCardSkeleton />)
  const photo = NativeStyles.flatten(view.getAllByTestId('skeleton-block', { includeHiddenElements: true })[0].props.style)
  expect(photo).toMatchObject({ width: '100%', aspectRatio: 1.6 })
  expect(photo.height).toBeUndefined()
  await view.unmount()
  preference.mockRestore()
})
