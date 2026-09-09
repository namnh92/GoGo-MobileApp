import { act, render, screen } from '@testing-library/react-native'

// The native expo-image adapter cannot receive a synthetic `error` event under
// jest; the React Native Image keeps `onError` as a plain prop, and the
// fallback logic under test lives in AvatarCircle, not in the image
// implementation.
jest.mock('expo-image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Image: require('react-native').Image,
}))

/** What the native side does when the bytes do not arrive. */
async function failToLoad() {
  const image = screen.getByTestId('avatar-image')
  await act(async () => {
    ;(image.props as { onError: (e: unknown) => void }).onError({ nativeEvent: { error: 'not found' } })
  })
}

import { AvatarCircle } from '@/shared/ui/primitives'

/**
 * PROF-APP-001 (#176), ADR-0022 — one avatar primitive for every surface. A
 * picture is drawn when the API composed a URL, and the initials are drawn
 * when there is none or the bytes do not arrive: a purged object, a dead edge
 * cache, no network. A broken image must never be what a co-member sees.
 */
describe('AvatarCircle', () => {
  it('draws the initials when there is no picture', async () => {
    await render(<AvatarCircle label="A" />)
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.queryByTestId('avatar-image')).toBeNull()
  })

  it('draws the picture when the API composed a URL', async () => {
    await render(<AvatarCircle label="A" imageUri="https://assets-test.local/avatars/x.webp" />)
    expect(screen.getByTestId('avatar-image')).toBeTruthy()
    expect(screen.queryByText('A')).toBeNull()
  })

  it('falls back to the initials when the picture fails to load', async () => {
    await render(<AvatarCircle label="A" imageUri="https://assets-test.local/avatars/gone.webp" />)
    await failToLoad()
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.queryByTestId('avatar-image')).toBeNull()
  })

  it('tries a new picture after an old one failed', async () => {
    const first = 'https://assets-test.local/avatars/old.webp'
    const second = 'https://assets-test.local/avatars/new.webp'
    const rendered = await render(<AvatarCircle label="A" imageUri={first} />)
    await failToLoad()
    expect(screen.getByText('A')).toBeTruthy()

    await rendered.rerender(<AvatarCircle label="A" imageUri={second} />)
    expect(screen.getByTestId('avatar-image')).toBeTruthy()
  })

  it('null means initials, the same as undefined', async () => {
    await render(<AvatarCircle label="B" imageUri={null} />)
    expect(screen.getByText('B')).toBeTruthy()
  })
})
