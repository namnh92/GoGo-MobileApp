import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles'
import { themes, type AppTheme } from '@/shared/ui/theme'
import { act, render, screen, within } from '@testing-library/react-native'

// The native expo-image adapter cannot receive synthetic load/error events
// under jest; React Native's Image keeps `onLoad`/`onError` as plain props,
// and the logic under test lives in PlacePhoto (as in avatar-circle.spec).
jest.mock('expo-image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Image: require('react-native').Image,
}))
const mockReduced: { value: boolean | null } = { value: false }
jest.mock('@/shared/ui/feedback', () => ({
  useReducedMotionPreference: () => mockReduced.value,
  motionDuration: (d: number, r: boolean) => (r ? 0 : d),
}))

import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { motion } from '@/shared/ui/tokens'

const PHOTO = 'https://assets.example/places/p1.jpg'

type Handler = (e: unknown) => void
async function fire(event: 'onLoad' | 'onError') {
  const image = screen.getByTestId('place-photo-image')
  await act(async () => {
    // Optional call: a component with no handler is the bug, not a test error.
    ;(image.props as Record<string, Handler | undefined>)[event]?.({ nativeEvent: {} })
  })
}

beforeEach(() => {
  mockReduced.value = false
})

/**
 * GoGo-MobileApp#338 — a place photo that is loading shows the pin tile under
 * it; one that fails shows the pin tile instead, exactly like a place with no
 * photo, and is not announced as a photo.
 */
describe('PlacePhoto', () => {
  it('no photo: the decorative pin tile, hidden from a screen reader', async () => {
    await render(<PlacePhoto placeId="p1" name="Cà phê" />)
    const tile = screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })
    expect(tile.props.accessibilityElementsHidden).toBe(true)
    expect(tile.props.importantForAccessibility).toBe('no-hide-descendants')
    expect(screen.queryByTestId('place-photo-image')).toBeNull()
  })

  it('loading: the pin tile waits under the image, which carries the name', async () => {
    await render(<PlacePhoto placeId="p1" name="Cà phê" uri={PHOTO} />)
    const image = screen.getByTestId('place-photo-image')
    expect(image.props.accessibilityLabel).toBe('Cà phê')
    // Sol #348 F-06: expo-image is not an accessibility element by default, so
    // a label alone is never read; the labelled image must opt in.
    expect(image.props.accessible).toBe(true)
    const waiting = screen.getByTestId('place-photo-loading', { includeHiddenElements: true })
    expect(waiting.props.accessibilityElementsHidden).toBe(true)
  })

  it('an image with nothing to say is not an accessibility element', async () => {
    await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    const image = screen.getByTestId('place-photo-image')
    expect(image.props.accessibilityLabel).toBeUndefined()
    expect(image.props.accessible).not.toBe(true)
  })

  it('loaded: the neutral tile remains beneath the native fade', async () => {
    await render(<PlacePhoto placeId="p1" name="Cà phê" uri={PHOTO} />)
    await fire('onLoad')
    expect(screen.queryByTestId('place-photo-loading', { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId('place-photo-image')).toBeTruthy()
    expect(screen.getByTestId('place-photo-underlay', { includeHiddenElements: true })).toBeTruthy()
  })

  it('failed: the same pin tile as no photo, and no image left to announce', async () => {
    await render(<PlacePhoto placeId="p1" name="Cà phê" uri={PHOTO} />)
    await fire('onError')
    expect(screen.queryByTestId('place-photo-image')).toBeNull()
    expect(screen.queryByLabelText('Cà phê')).toBeNull()
    const tile = screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })
    expect(tile.props.accessibilityElementsHidden).toBe(true)
  })

  it('a new photo after a failed one gets its own attempt', async () => {
    const view = await render(<PlacePhoto placeId="p1" name="Cà phê" uri={PHOTO} />)
    await fire('onError')
    await view.rerender(<PlacePhoto placeId="p1" name="Cà phê" uri="https://assets.example/places/p1-v2.jpg" />)
    expect(screen.getByTestId('place-photo-image')).toBeTruthy()
  })

  it('fades in on the motion token, and cuts in under reduced motion', async () => {
    const view = await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    expect(screen.getByTestId('place-photo-image').props.transition).toBe(motion.standard)
    await view.unmount()
    mockReduced.value = true
    await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    expect(screen.getByTestId('place-photo-image').props.transition).toBe(0)
  })

  // Sol #348 F-03: a cached image can land before the OS answers.
  it('cuts in while the reduced-motion answer is not known yet', async () => {
    mockReduced.value = null
    await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    expect(screen.getByTestId('place-photo-image').props.transition).toBe(0)
  })

  // Sol #348 F-04: design-system motion is 150–300 ms.
  it('uses a fade inside the 150–300 ms range', () => {
    expect(motion.standard).toBeGreaterThanOrEqual(150)
    expect(motion.standard).toBeLessThanOrEqual(300)
  })

  // Sol #348 F-01: a new URL never shows the previous picture over its stand-in.
  it('a new URL starts over: stand-in back, image not recycled from the last one', async () => {
    const next = 'https://assets.example/places/p2.jpg'
    const view = await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    await fire('onLoad')
    await view.rerender(<PlacePhoto placeId="p2" uri={next} />)
    expect(screen.getByTestId('place-photo-loading', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByTestId('place-photo-image').props.recyclingKey).toBe(next)
  })

  // Sol #348 F-02: the outcome of one URL never decides another visit to it.
  it('A fails, B, then A again: A gets a fresh attempt', async () => {
    const other = 'https://assets.example/places/p2.jpg'
    const view = await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    await fire('onError')
    await view.rerender(<PlacePhoto placeId="p1" uri={other} />)
    await view.rerender(<PlacePhoto placeId="p1" uri={PHOTO} />)
    expect(screen.getByTestId('place-photo-image').props.source).toEqual({ uri: PHOTO, cacheKey: PHOTO })
    expect(screen.getByTestId('place-photo-loading', { includeHiddenElements: true })).toBeTruthy()
  })

  it('A loaded, B, then A again: A waits for its own load', async () => {
    const other = 'https://assets.example/places/p2.jpg'
    const view = await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    await fire('onLoad')
    await view.rerender(<PlacePhoto placeId="p1" uri={other} />)
    await view.rerender(<PlacePhoto placeId="p1" uri={PHOTO} />)
    expect(screen.getByTestId('place-photo-loading', { includeHiddenElements: true })).toBeTruthy()
  })
})


it('caches provider data URIs with a stable key across mounts', async () => {
  await render(<PlacePhoto placeId="p1" uri="data:image/jpeg;base64,YQ==" />)
  expect(screen.getByTestId('place-photo-image').props.cachePolicy).toBe('memory-disk')
  expect(screen.getByTestId('place-photo-image').props.source).toMatchObject({ cacheKey: 'data:image/jpeg;base64,YQ==' })
})


it('reserves identical geometry before URI arrival, during decode, after load and on error', async () => {
  const size = { width: 80, height: 80, borderRadius: 10, flexShrink: 0 }
  const view = await render(<PlacePhoto placeId="p1" style={size} />)
  const frame = () => StyleSheet.flatten(screen.getByTestId('place-photo-frame').props.style)
  const initial = frame()
  expect(initial).toMatchObject(size)
  await view.rerender(<PlacePhoto placeId="p1" uri={PHOTO} style={size} />)
  expect(screen.getByTestId('place-photo-loading', { includeHiddenElements: true })).toBeTruthy()
  expect(frame()).toEqual(initial)
  expect(StyleSheet.flatten(screen.getByTestId('place-photo-image').props.style)).toMatchObject({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 })
  await fire('onLoad')
  expect(frame()).toEqual(initial)
  await fire('onError')
  expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
  expect(frame()).toEqual(initial)
})

it.each(['orange', 'orangeDark'] as const)('uses a role surface and neutral icon in every state (%s)', async themeName => {
  const create = jest.spyOn(UnistylesStyleSheet, 'create')
  try {
    jest.isolateModules(() => { jest.requireActual('@/shared/ui/place-photo.style') })
    const factory = create.mock.calls[0][0] as (theme: AppTheme) => Record<string, any>
    expect(factory(themes[themeName]).image.backgroundColor).toBe(themes[themeName].surface.subtle)
  } finally { create.mockRestore() }
  const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
  const { rt } = unistyles.useUnistyles()
  jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme: themes[themeName], rt })
  try {
    await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    const tile = screen.getByTestId('place-photo-loading', { includeHiddenElements: true })
    expect(within(tile).getByTestId('icon-map-pin', { includeHiddenElements: true }).props.color).toBe(themes[themeName].text.secondary)
    await fire('onError')
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
  } finally { jest.restoreAllMocks() }
})
