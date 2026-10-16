import { act, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'

// Same stand-in as place-photo.spec: the logic under test lives in PlacePhoto,
// and here in the real `useReducedMotionPreference` — this file does NOT mock
// `@/shared/ui/feedback`, which is why it is separate.
jest.mock('expo-image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Image: require('react-native').Image,
}))

import { PlacePhoto } from '@/shared/ui/place-photo.view'

const PHOTO = 'https://assets.example/places/p1.jpg'

/** A promise the test resolves by hand, so "before the OS answers" is observable. */
function deferred() {
  let resolve!: (value: boolean) => void
  const promise = new Promise<boolean>(r => {
    resolve = r
  })
  return { promise, resolve }
}

function transition(): unknown {
  return screen.getByTestId('place-photo-image').props.transition
}

/**
 * Sol #348 F-05 — the hook remembers the OS answer across mounts. A remembered
 * `false` is the one that can be wrong in the harmful direction: the user turns
 * `Giảm chuyển động` on while nothing is subscribed, and the next photo would
 * fade on the strength of a stale "no". The cache is module state, so this file
 * holds exactly one scenario.
 */
describe('PlacePhoto × reduced motion across mounts', () => {
  it('a remembered "not reduced" never lets a later mount fade before the OS answers again', async () => {
    const query = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    // React Native's jest mock already answers `addEventListener` with a
    // `{ remove: jest.fn() }` subscription; the spy only lets us read it back.
    const listen = jest.spyOn(AccessibilityInfo, 'addEventListener')

    // 1. First consumer: the OS says "not reduced" → the photo fades.
    const first = deferred()
    query.mockImplementation(() => first.promise)
    const view = await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    await act(async () => first.resolve(false))
    expect(transition()).toBeGreaterThan(0)

    // 2. Nobody is mounted; the user turns Reduce Motion on. No listener hears it.
    await view.unmount()
    expect(listen).toHaveBeenCalledTimes(1)
    const subscription = listen.mock.results[0].value as unknown as { remove: jest.Mock }
    expect(subscription.remove).toHaveBeenCalledTimes(1)

    // 3. Next consumer mounts. Before the OS answers, it must not fade …
    const second = deferred()
    query.mockImplementation(() => second.promise)
    await render(<PlacePhoto placeId="p1" uri={PHOTO} />)
    expect(transition()).toBe(0)

    // … and once the OS says "reduced", still not.
    await act(async () => second.resolve(true))
    expect(transition()).toBe(0)
  })
})
