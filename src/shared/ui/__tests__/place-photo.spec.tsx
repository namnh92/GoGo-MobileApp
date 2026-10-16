import { act, render, screen } from '@testing-library/react-native'

// The native expo-image adapter cannot receive synthetic load/error events
// under jest; React Native's Image keeps `onLoad`/`onError` as plain props,
// and the logic under test lives in PlacePhoto (as in avatar-circle.spec).
jest.mock('expo-image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Image: require('react-native').Image,
}))
const mockReduced = { value: false }
jest.mock('@/shared/ui/feedback', () => ({ useReducedMotion: () => mockReduced.value, motionDuration: (d: number, r: boolean) => (r ? 0 : d) }))

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
    expect(screen.getByTestId('place-photo-image').props.transition).toBe(motion.fast)
    await view.unmount()
    mockReduced.value = true
    await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    expect(screen.getByTestId('place-photo-image').props.transition).toBe(0)
  })
})
