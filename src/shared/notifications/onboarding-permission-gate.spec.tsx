import { act, render } from '@testing-library/react-native'
import { OnboardingPermissionGate } from './onboarding-permission-gate'
import { createOnboardingPermissionStore } from './onboarding-permission-store'

const mockState = { status: 'user', segments: ['(tabs)'], active: true, hidden: true }
jest.mock('expo-router', () => ({ useSegments: () => mockState.segments }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockState.status }) }))
jest.mock('@/shared/hooks/use-app-foreground', () => ({ useAppForeground: () => mockState.active }))
jest.mock('@/shared/ui/splash-state', () => ({ isSplashHidden: () => mockState.hidden, subscribeSplashHidden: () => () => {} }))
jest.mock('./permission-bootstrap', () => ({ pushPermission: { request: jest.fn() } }))
jest.mock('@/shared/consent/tracking', () => ({ trackingConsent: { settled: jest.fn() } }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function fixture(pending = true) {
  const store = createOnboardingPermissionStore({ getItem: async () => null, setItem: async () => {} })
  if (pending) await store.defer()
  const settlement = deferred<void>()
  const consent = { settled: jest.fn(() => settlement.promise) }
  const request = jest.fn(async (): Promise<unknown> => undefined)
  const element = <OnboardingPermissionGate store={store} consent={consent} request={request} />
  return { store, settlement, consent, request, element }
}
beforeEach(() => { Object.assign(mockState, { status: 'user', segments: ['(tabs)'], active: true, hidden: true }) })

it('never requests without Start intent', async () => {
  const f = await fixture(false)
  await render(f.element)
  await act(async () => { f.settlement.resolve() })
  expect(f.consent.settled).not.toHaveBeenCalled()
  expect(f.request).not.toHaveBeenCalled()
})
it.each([
  ['hydration', { status: 'hydrating' }], ['anonymous', { status: 'anonymous' }], ['guest', { status: 'guest' }],
  ['auth', { segments: ['auth', 'sign-in'] }], ['onboarding', { segments: ['onboarding'] }],
  ['index', { segments: ['index'] }], ['empty route', { segments: [] }],
  ['splash', { hidden: false }], ['background', { active: false }],
])('retains intent and makes no request during %s', async (_label, state) => {
  Object.assign(mockState, state)
  const f = await fixture()
  await render(f.element)
  await act(async () => { f.settlement.resolve() })
  expect(f.request).not.toHaveBeenCalled()
  expect(f.store.snapshot()).toBe(true)
})
it('failed/abandoned auth retains intent until later successful entry', async () => {
  Object.assign(mockState, { status: 'anonymous', segments: ['auth', 'sign-in'] })
  const f = await fixture()
  const view = await render(f.element)
  // Failed auth leaves the session anonymous; abandoning it can enter the app anonymously.
  await view.rerender(f.element)
  mockState.segments = ['(tabs)']
  await view.rerender(<OnboardingPermissionGate store={f.store} consent={f.consent} request={f.request} />)
  await act(async () => { f.settlement.resolve() })
  expect(f.request).not.toHaveBeenCalled()
  expect(f.store.snapshot()).toBe(true)
  mockState.status = 'user'
  await view.rerender(<OnboardingPermissionGate store={f.store} consent={f.consent} request={f.request} />)
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.store.snapshot()).toBe(false)
})
it.each([
  ['background', { active: false }], ['logout', { status: 'anonymous' }],
  ['route departure', { segments: ['auth', 'sign-in'] }], ['splash return', { hidden: false }],
])('cancels before requesting on %s during settlement, then resumes once', async (_label, state) => {
  const f = await fixture()
  const view = await render(f.element)
  expect(f.consent.settled).toHaveBeenCalledTimes(1)
  Object.assign(mockState, state)
  await view.rerender(<OnboardingPermissionGate store={f.store} consent={f.consent} request={f.request} />)
  await act(async () => { f.settlement.resolve() })
  expect(f.request).not.toHaveBeenCalled()
  expect(f.store.snapshot()).toBe(true)
  Object.assign(mockState, { status: 'user', segments: ['(tabs)'], active: true, hidden: true })
  await view.rerender(<OnboardingPermissionGate store={f.store} consent={f.consent} request={f.request} />)
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.store.snapshot()).toBe(false)
})
it('unmount during settlement retains intent; remount resumes once', async () => {
  const f = await fixture()
  const view = await render(f.element)
  await view.unmount()
  await act(async () => { f.settlement.resolve() })
  expect(f.request).not.toHaveBeenCalled()
  expect(f.store.snapshot()).toBe(true)
  await render(f.element)
  expect(f.request).toHaveBeenCalledTimes(1)
})
it('remount during an unresolved request cannot duplicate the attempt', async () => {
  const f = await fixture()
  const attempt = deferred<unknown>()
  f.request.mockImplementation(() => attempt.promise)
  const view = await render(f.element)
  await act(async () => { f.settlement.resolve() })
  expect(f.request).toHaveBeenCalledTimes(1)
  await view.unmount()
  const remounted = await render(f.element)
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.store.snapshot()).toBe(true)
  // Navigation is free to leave while the OS request is unresolved.
  mockState.segments = ['auth', 'sign-in']
  await remounted.rerender(<OnboardingPermissionGate store={f.store} consent={f.consent} request={f.request} />)
  await act(async () => { attempt.resolve(undefined) })
  expect(f.store.snapshot()).toBe(false)
})
it.each(['rejected', 'unavailable'])('consumes a %s attempt without blocking navigation', async outcome => {
  const f = await fixture()
  if (outcome === 'rejected') f.request.mockRejectedValueOnce(new Error('permission rejected'))
  else f.request.mockResolvedValueOnce({ available: false })
  const view = await render(f.element)
  await act(async () => { f.settlement.resolve() })
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.store.snapshot()).toBe(false)
  mockState.segments = ['place', 'details']
  await view.rerender(<OnboardingPermissionGate store={f.store} consent={f.consent} request={f.request} />)
  expect(f.request).toHaveBeenCalledTimes(1)
})
