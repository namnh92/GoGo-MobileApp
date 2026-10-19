import { act, fireEvent, render, screen } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#366 (AC-A2.2) — when the tracking sheet appears: once per
 * launch, only at a real moment (splash lifted, app active, a session, past
 * sign-in and onboarding), only while iOS has no answer; a moment that ends
 * first puts the question back; it is settled only by an answer.
 */

const mockState = { status: 'anonymous' as string, segments: [] as string[] }

jest.mock('expo-router', () => ({ useSegments: () => mockState.segments }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockState.status }) }))
jest.mock('expo-tracking-transparency', () => ({}))
let mockActive = true
jest.mock('@/shared/hooks/use-app-foreground', () => ({ useAppForeground: () => mockActive }))

import i18n from '@/shared/i18n'
import { markSplashHidden } from '@/shared/ui/splash-state'
import { resetTrackingConsentLaunch, TrackingConsentGate } from '../tracking-consent-gate'
import type { TrackingConsent, TrackingStatus } from '../tracking'

function fakeConsent(initial: TrackingStatus, read?: Promise<TrackingStatus>) {
  const calls: string[] = []
  const consent: TrackingConsent = {
    status: jest.fn(() => read ?? Promise.resolve(initial)),
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
  mockActive = true
  mockState.status = 'anonymous'
  mockState.segments = []
})

it('waits for the splash, a session and a screen past sign-in, then asks once', async () => {
  const { consent, calls } = fakeConsent('undetermined')
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  const view = await render(<TrackingConsentGate consent={consent} />)
  await flush()
  // Splash still up.
  expect(consent.status).not.toHaveBeenCalled()

  mockState.segments = ['(tabs)', 'sign-in']
  await act(async () => markSplashHidden())
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
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

  mockState.segments = ['plans']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).toHaveBeenCalledTimes(1)
})

it('not in the foreground: no sheet yet', async () => {
  markSplashHidden()
  mockActive = false
  const { consent } = fakeConsent('undetermined')
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  await render(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).not.toHaveBeenCalled()
})

it('a read whose moment passed is retired, and the next moment asks', async () => {
  markSplashHidden()
  let answer!: (status: TrackingStatus) => void
  const read = new Promise<TrackingStatus>(resolve => {
    answer = resolve
  })
  const { consent } = fakeConsent('undetermined', read)
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  const view = await render(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).toHaveBeenCalledTimes(1)

  // Signed out while iOS was being read.
  mockState.status = 'anonymous'
  mockState.segments = ['(tabs)', 'sign-in']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await act(async () => answer('undetermined'))
  await flush()
  expect(title()).toBeNull()

  // Signed back in: asked at this moment, not left until the next launch.
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  ;(consent.status as jest.Mock).mockImplementation(() => Promise.resolve('undetermined'))
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(consent.status).toHaveBeenCalledTimes(2)
  expect(title()).not.toBeNull()
})

it('a sheet left unanswered when the session ends is taken down, not settled, and comes back', async () => {
  markSplashHidden()
  const { consent, calls } = fakeConsent('undetermined')
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  const view = await render(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(title()).not.toBeNull()

  mockState.status = 'anonymous'
  mockState.segments = ['(tabs)', 'sign-in']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(title()).toBeNull()
  expect(calls).toEqual([])

  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  await view.rerender(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(title()).not.toBeNull()
})

it('"Để sau" closes without asking iOS, and settles', async () => {
  markSplashHidden()
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

it('one "Để sau" control for screen readers, unavailable while iOS is asking', async () => {
  markSplashHidden()
  const { consent } = fakeConsent('undetermined')
  ;(consent.request as jest.Mock).mockImplementation(() => new Promise(() => {}))
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  await render(<TrackingConsentGate consent={consent} />)
  await flush()
  await act(async () => {
    fireEvent.press(screen.getByText(i18n.t('consent.tracking.continue')))
  })
  const later = screen.getAllByLabelText(i18n.t('consent.tracking.later'))
  expect(later).toHaveLength(1)
  expect(later[0].props.accessibilityState).toMatchObject({ disabled: true })
})

it.each(['granted', 'denied', 'unavailable'] as const)('already %s: no sheet, settled', async status => {
  markSplashHidden()
  const { consent, calls } = fakeConsent(status)
  mockState.status = 'user'
  mockState.segments = ['(tabs)']
  await render(<TrackingConsentGate consent={consent} />)
  await flush()
  expect(title()).toBeNull()
  expect(calls).toEqual(['settle'])
})
