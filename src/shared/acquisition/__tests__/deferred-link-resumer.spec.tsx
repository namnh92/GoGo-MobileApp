import { act, render } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#364 — the resumer's readiness rule: nothing opens on the
 * splash or while nobody is signed in; the first time someone is, the pending
 * link opens once through the one DeepLinkRouter.
 */

const mockPush = jest.fn()
const mockState = { status: 'anonymous' as string, segments: [] as string[] }
const mockTake = jest.fn(async () => ({ kind: 'shareSlug', slug: 'abc123' }))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useSegments: () => mockState.segments,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockState.status }),
}))
jest.mock('@/shared/acquisition/bootstrap', () => ({ deferredLinkSettled: async () => undefined }))
jest.mock('@/shared/acquisition/pending-deep-links', () => ({ pendingDeepLinks: { take: () => mockTake() } }))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))

import { DeferredLinkResumer } from '../deferred-link-resumer'

async function settle() {
  await act(async () => {
    await new Promise(resolve => setImmediate(resolve))
  })
}

it('waits for the splash and a session, then opens the pending link once', async () => {
  const view = await render(<DeferredLinkResumer />)
  await settle()
  expect(mockTake).not.toHaveBeenCalled()

  // Past the splash, still signed out: the link keeps waiting.
  mockState.segments = ['(auth)', 'sign-in']
  await view.rerender(<DeferredLinkResumer />)
  await settle()
  expect(mockTake).not.toHaveBeenCalled()

  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  await view.rerender(<DeferredLinkResumer />)
  await settle()
  expect(mockTake).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledTimes(1)
  expect(mockPush.mock.calls[0][0]).toContain('abc123')

  // Signed out and back in, same process: nothing opens a second time.
  mockState.status = 'anonymous'
  await view.rerender(<DeferredLinkResumer />)
  mockState.status = 'guest'
  await view.rerender(<DeferredLinkResumer />)
  await settle()
  expect(mockTake).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledTimes(1)
  await act(async () => { await view.unmount() })
})
