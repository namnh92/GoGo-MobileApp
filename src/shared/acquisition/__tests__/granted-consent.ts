/**
 * For bootstrap suites about something other than consent (#370): an Android
 * person who has already said yes. Standing in for both consent modules with
 * `vi.mock('@/shared/consent/tracking', () => import('./granted-consent'))`.
 */
export const consentStore = {
  get: () => 'granted' as const,
  generation: () => 0,
}

export const trackingConsent = {
  status: async () => 'granted' as const,
  settled: () => Promise.resolve(),
  answer: () => {},
}
