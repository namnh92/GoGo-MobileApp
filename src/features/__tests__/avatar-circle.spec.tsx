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

import { StyleSheet } from 'react-native'
import { themes } from '@/shared/ui/theme'

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

  it('keeps initials visible until the picture has loaded', async () => {
    await render(<AvatarCircle label="A" imageUri="https://assets-test.local/avatars/x.webp" />)
    expect(screen.getByTestId('avatar-image')).toBeTruthy()
    expect(screen.getByText('A')).toBeTruthy()
    await act(async () => { screen.getByTestId('avatar-image').props.onLoad() })
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

it('keeps the host ring and star visible over a loaded photo; ordinary avatars have no badge', async () => {
  const view = await render(<AvatarCircle label="A" host imageUri="https://assets-test.local/avatars/host.webp" />)
  await act(async () => { screen.getByTestId('avatar-image').props.onLoad() })
  const badge = screen.getByTestId('avatar-host-badge')
  expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ backgroundColor: themes.orange.surface.card, bottom: 0, right: 0 })
  const ring = badge.parent!.children[1]
  expect(StyleSheet.flatten(typeof ring === 'string' ? {} : ring.props.style)).toMatchObject({ borderWidth: 2, borderColor: themes.orange.accent.primary })
  await view.rerender(<AvatarCircle label="A" />)
  expect(screen.queryByTestId('avatar-host-badge')).toBeNull()
})
