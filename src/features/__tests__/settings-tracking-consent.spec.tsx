import { act, fireEvent, screen } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#370 (shape D5, D9) — the Settings half of the consent:
 * Android × {granted, denied, undetermined, storage error, loading, no MMP in
 * this build}; iOS × one way to the OS, which owns the answer.
 */

const mockStore: {
  listeners: Set<() => void>
  snapshot: { value: string; loaded: boolean; save: string }
  load: jest.Mock
  retry: jest.Mock
  subscribe(listener: () => void): () => void
} = {
  listeners: new Set<() => void>(),
  snapshot: { value: 'undetermined', loaded: true, save: 'idle' },
  load: jest.fn(async () => mockStore.snapshot.value),
  retry: jest.fn(),
  subscribe(listener: () => void) {
    mockStore.listeners.add(listener)
    return () => {
      mockStore.listeners.delete(listener)
    }
  },
}
jest.mock('@/shared/consent/consent-store', () => ({
  consentStore: {
    load: () => mockStore.load(),
    retry: () => mockStore.retry(),
    subscribe: (listener: () => void) => mockStore.subscribe(listener),
    snapshot: () => mockStore.snapshot,
  },
}))
const mockAcquisition = { configured: true, set: jest.fn() }
jest.mock('@/shared/acquisition/bootstrap', () => ({
  acquisitionConfigured: () => mockAcquisition.configured,
  setAcquisitionConsent: (granted: boolean) => mockAcquisition.set(granted),
}))
const mockHaptic = jest.fn()
jest.mock('@/shared/ui/feedback', () => ({
  ...jest.requireActual('@/shared/ui/feedback'),
  haptic: (kind: string) => mockHaptic(kind),
}))

import i18n from '@/shared/i18n'
import { TrackingConsentSection } from '@/features/settings/tracking-consent.view'

const SWITCH = () => i18n.t('permissionsSettings.trackingSwitch')
const OFF_HINT = () => i18n.t('permissionsSettings.trackingOffHint')
const UNSAVED = () => i18n.t('permissionsSettings.trackingUnsaved')
/** Android's host Switch carries the value as `on`. */
const switchIsOn = () => screen.getByLabelText(SWITCH()).props.on
const realOS = Platform.OS

function set(next: Partial<typeof mockStore.snapshot>) {
  mockStore.snapshot = { ...mockStore.snapshot, ...next }
}

beforeEach(() => {
  mockStore.snapshot = { value: 'undetermined', loaded: true, save: 'idle' }
  mockAcquisition.configured = true
  jest.clearAllMocks()
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' })
})
afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => realOS })
})

describe('Android', () => {
  it('granted: on, the full data list as its label, no off hint', async () => {
    set({ value: 'granted' })
    await renderScreen(<TrackingConsentSection />)
    expect(switchIsOn()).toBe(true)
    expect(screen.getByText(SWITCH())).toBeTruthy()
    expect(screen.queryByText(OFF_HINT())).toBeNull()
  })

  it.each(['denied', 'undetermined'])('%s: off, and it says what off costs', async value => {
    set({ value })
    await renderScreen(<TrackingConsentSection />)
    expect(switchIsOn()).toBe(false)
    expect(screen.getByText(OFF_HINT())).toBeTruthy()
  })

  it.each([
    ['granted', false],
    ['denied', true],
  ] as const)('from %s the switch commits %s, with one tick', async (value, next) => {
    set({ value })
    await renderScreen(<TrackingConsentSection />)
    await act(async () => {
      fireEvent(screen.getByLabelText(SWITCH()), 'valueChange', next)
    })
    expect(mockAcquisition.set).toHaveBeenCalledTimes(1)
    expect(mockAcquisition.set).toHaveBeenCalledWith(next)
    expect(mockHaptic).toHaveBeenCalledTimes(1)
  })

  it('a choice that could not be saved says so and offers a retry that works', async () => {
    set({ value: 'denied', save: 'unsaved' })
    await renderScreen(<TrackingConsentSection />)
    expect(switchIsOn()).toBe(false)
    expect(screen.getByText(UNSAVED())).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByText(i18n.t('common.retry')))
    })
    expect(mockStore.retry).toHaveBeenCalledTimes(1)
  })

  it('says nothing about saving while it is fine', async () => {
    set({ value: 'denied', save: 'saved' })
    await renderScreen(<TrackingConsentSection />)
    expect(screen.queryByText(UNSAVED())).toBeNull()
  })

  it('loading: a skeleton row, no switch telling a value it does not have', async () => {
    set({ loaded: false })
    await renderScreen(<TrackingConsentSection />)
    expect(screen.queryByLabelText(SWITCH())).toBeNull()
    expect(screen.getByLabelText(i18n.t('common.loading'))).toBeTruthy()
    expect(mockStore.load).toHaveBeenCalled()
  })

  it('a build with no MMP: the reason, no dead switch', async () => {
    mockAcquisition.configured = false
    await renderScreen(<TrackingConsentSection />)
    expect(screen.getByText(i18n.t('permissionsSettings.trackingUnavailable'))).toBeTruthy()
    expect(screen.queryByLabelText(SWITCH())).toBeNull()
  })

  it('follows the store while on screen', async () => {
    await renderScreen(<TrackingConsentSection />)
    expect(switchIsOn()).toBe(false)
    await act(async () => {
      set({ value: 'granted' })
      for (const listener of mockStore.listeners) listener()
    })
    expect(switchIsOn()).toBe(true)
  })
})

describe('iOS', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' })
  })

  it('the OS owns the answer: no switch, and the button really opens Settings', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    await renderScreen(<TrackingConsentSection />)
    expect(screen.queryByLabelText(SWITCH())).toBeNull()
    expect(screen.getByText(i18n.t('permissionsSettings.trackingIos'))).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByText(i18n.t('permissionsSettings.openSettings')))
    })
    expect(open).toHaveBeenCalledTimes(1)
    expect(mockStore.load).not.toHaveBeenCalled()
  })

  it('a Settings that will not open says so', async () => {
    jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('no'))
    await renderScreen(<TrackingConsentSection />)
    await act(async () => {
      fireEvent.press(screen.getByText(i18n.t('permissionsSettings.openSettings')))
    })
    expect(screen.getByText(i18n.t('notificationSettings.openSettingsFailed'))).toBeTruthy()
  })
})
