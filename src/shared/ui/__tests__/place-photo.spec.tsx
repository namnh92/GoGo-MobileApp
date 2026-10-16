import { act, render, screen } from '@testing-library/react-native'

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
    expect(screen.getByTestId('place-photo-image').props.accessibilityLabel).toBe('Cà phê')
    const waiting = screen.getByTestId('place-photo-loading', { includeHiddenElements: true })
    expect(waiting.props.accessibilityElementsHidden).toBe(true)
  })

  it('loaded: the stand-in goes away', async () => {
    await render(<PlacePhoto placeId="p1" name="Cà phê" uri={PHOTO} />)
    await fire('onLoad')
    expect(screen.queryByTestId('place-photo-loading', { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId('place-photo-image')).toBeTruthy()
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
    expect(screen.getByTestId('place-photo-image').props.source).toEqual({ uri: PHOTO })
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
