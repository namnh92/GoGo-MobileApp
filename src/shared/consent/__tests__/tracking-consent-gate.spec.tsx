import { act, fireEvent, render, screen } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#366 (AC-A2.2) — when the tracking sheet appears: once per
 * launch, only after someone is signed in, never on sign-in or onboarding,
 * only while iOS has not been answered; and the launch's question always ends
 * settled.
 */

const mockState = { status: 'anonymous' as string, segments: [] as string[] }

jest.mock('expo-router', () => ({ useSegments: () => mockState.segments }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockState.status }) }))
jest.mock('expo-tracking-transparency', () => ({}))

import i18n from '@/shared/i18n'
import { resetTrackingConsentLaunch, TrackingConsentGate } from '../tracking-consent-gate'
import type { TrackingConsent, TrackingStatus } from '../tracking'

function fakeConsent(initial: TrackingStatus) {
  const calls: string[] = []
  const consent: TrackingConsent = {
    status: jest.fn(async () => initial),
    request: jest.fn(async () => {
      calls.push('request')
      return 'granted' as const
    }),
    later: jest.fn(() => calls.push('later')),
    settle: jest.fn(() => calls.push('settle')),
    settled: () => Promise.resolve(),
  }
  return { consent, calls }
}

async function flush() {
  await act(async () => {
    await new Promise(resolve => setImmediate(resolve))
  })
}

const title = () => screen.queryByText(i18n.t('consent.tracking.title'))

beforeEach(() => {
  resetTrackingConsentLaunch()
  mockState.status = 'anonymous'
  mockState.segments = []
})

it('waits for a session and a screen past sign-in, then asks once', async () => {
  const { consent, calls } = fakeConsent('undetermined')
  const view = await render(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).not.toHaveBeenCalled()

  mockState.status = 'user'
  mockState.segments = ['(tabs)', 'sign-in']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).not.toHaveBeenCalled()

  mockState.segments = ['onboarding']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).not.toHaveBeenCalled()

  mockState.segments = ['(tabs)']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(title()).not.toBeNull()

  await act(async () => {
    fireEvent.press(screen.getByText(i18n.t('consent.tracking.continue')))
  })
  await flush()
  expect(calls).toEqual(['request', 'settle'])
  expect(title()).toBeNull()

  // Same launch, another screen: never again.
  mockState.segments = ['plans']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).toHaveBeenCalledTimes(1)
})

it('"Để sau" closes without asking iOS, and settles', async () => {
  const { consent, calls } = fakeConsent('undetermined')
  mockState.status = 'guest'
  mockState.segments = ['room', '[roomId]']
  await render(<TrackingConsentGate consent={consent} />)
  await flush()
  await act(async () => {
    fireEvent.press(screen.getByText(i18n.t('consent.tracking.later')))
  })
  expect(calls).toEqual(['later'])
  expect(consent.request).not.toHaveBeenCalled()
  expect(title()).toBeNull()
})

it.each(['granted', 'denied', 'unavailable'] as const)('already %s: no sheet, settled', async status => {
  const { consent, calls } = fakeConsent(status)
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  await render(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(title()).toBeNull()
  expect(calls).toEqual(['settle'])
})
