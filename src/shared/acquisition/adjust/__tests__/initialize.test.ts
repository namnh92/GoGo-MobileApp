import { describe, expect, it } from 'vitest'

import {
  ADJUST_ATT_WAIT_SECONDS,
  adjustEnvironmentFor,
  adjustTokenOf,
  createAdjustInitializer,
  type AdjustConfigLike,
  type AdjustEnvironment,
  type AdjustSdkLike,
} from '../initialize'

/** GoGo-MobileApp#367 — AC-A2 / AC-A3 (shape rev 2 order). */

function fakeSdk(over: { initThrows?: boolean } = {}) {
  const calls: string[] = []
  const created: { token: string; environment: AdjustEnvironment }[] = []
  let deferred: ((payload: { deeplink: string }) => void) | undefined
  let attribution: ((value: unknown) => void) | undefined
  const config: AdjustConfigLike & Record<string, unknown> = {
    disableDeferredDeeplinkOpening: () => calls.push('disableDeferredDeeplinkOpening'),
    setAttConsentWaitingInterval: (seconds: number) => calls.push(`setAttConsentWaitingInterval(${seconds})`),
    setDeferredDeeplinkCallback: callback => {
      deferred = callback
      calls.push('setDeferredDeeplinkCallback')
    },
    setAttributionCallback: callback => {
      attribution = callback
      calls.push('setAttributionCallback')
    },
  }
  const sdk: AdjustSdkLike = {
    createConfig: (token, environment) => {
      created.push({ token, environment })
      return config
    },
    initSdk: () => {
      if (over.initThrows) throw new Error('native')
      calls.push('initSdk')
    },
  }
  return { sdk, calls, created, fire: { deferred: (p: unknown) => deferred?.(p as { deeplink: string }), attribution: () => attribution?.({}) } }
}

describe('Adjust initializer', () => {
  it.each([
    ['dev', 'sandbox'],
    ['stag', 'sandbox'],
    ['prod', 'production'],
    [undefined, 'sandbox'],
    ['production', 'sandbox'],
  ] as const)('flavour %s → %s, decided in code', (flavor, expected) => {
    expect(adjustEnvironmentFor(flavor)).toBe(expected)
  })

  it('configures in the agreed order, then starts once', () => {
    const fake = fakeSdk()
    const start = createAdjustInitializer({ sdk: fake.sdk, flavor: 'dev', onDeferredLink: () => {}, onAttribution: () => {} })
    expect(start('abcdEFGH1234')).toBe(true)
    expect(start('abcdEFGH1234')).toBe(true)
    expect(fake.created).toEqual([{ token: 'abcdEFGH1234', environment: 'sandbox' }])
    expect(fake.calls).toEqual([
      'disableDeferredDeeplinkOpening',
      `setAttConsentWaitingInterval(${ADJUST_ATT_WAIT_SECONDS})`,
      'setDeferredDeeplinkCallback',
      'setAttributionCallback',
      'initSdk',
    ])
    expect(ADJUST_ATT_WAIT_SECONDS).toBe(60)
  })

  it('a failing SDK reports unavailable and never throws into startup', () => {
    const events: string[] = []
    const fake = fakeSdk({ initThrows: true })
    const start = createAdjustInitializer({
      sdk: fake.sdk,
      flavor: 'prod',
      onDeferredLink: () => {},
      onAttribution: () => {},
      onUnavailable: e => events.push(e),
    })
    expect(() => start('abcdEFGH1234')).not.toThrow()
    expect(events).toEqual(['acquisition_adjust_unavailable'])
  })

  it('forwards callbacks and contains their failures', () => {
    const events: string[] = []
    const seen: unknown[] = []
    const fake = fakeSdk()
    createAdjustInitializer({
      sdk: fake.sdk,
      flavor: 'dev',
      onDeferredLink: p => {
        seen.push(p)
        throw new Error('sink')
      },
      onAttribution: () => seen.push('attribution'),
      onUnavailable: e => events.push(e),
    })('abcdEFGH1234')
    expect(() => fake.fire.deferred({ deeplink: 'x' })).not.toThrow()
    fake.fire.attribution()
    expect(seen).toEqual([{ deeplink: 'x' }, 'attribution'])
    expect(events).toEqual(['acquisition_adjust_callback_failed'])
  })

  it('a token is 8-32 letters and digits; empty and off start nothing', () => {
    expect(adjustTokenOf('abcdEFGH1234')).toBe('abcdEFGH1234')
    for (const value of ['', 'off', 'abc', 'a'.repeat(33), 'abc def12', undefined, 12345678]) {
      expect(adjustTokenOf(value), String(value)).toBeNull()
    }
  })
})
