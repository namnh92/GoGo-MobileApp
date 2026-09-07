import { describe, expect, it, vi } from 'vitest'

import { createDeferredLinkCollector, deferredLinkFrom } from '../deferred-link'

const CANONICAL = 'https://go-dev.gogo.id.vn/l/abc123'
const INVITE = 'https://go-dev.gogo.id.vn/r/CODE12345'

function sdkReturning(info: Record<string, unknown>) {
  return { getAttributionInfo: (ok: (i: Record<string, unknown>) => void) => ok(info) }
}

describe('reading a deferred link out of attribution info', () => {
  it('takes the deep link under any of the keys Tenjin uses', () => {
    for (const key of ['deferred_deeplink_url', 'deeplink_url', 'deferred_deeplink', 'deep_link', 'url']) {
      expect(deferredLinkFrom({ [key]: CANONICAL })).toBe(CANONICAL)
    }
  })

  it('prefers the most specific key when a campaign sets several', () => {
    // A tracking URL under `url` alongside the real destination is the shape
    // that makes key order matter.
    expect(
      deferredLinkFrom({ url: INVITE, deferred_deeplink_url: CANONICAL }),
    ).toBe(CANONICAL)
  })

  it('ignores a URL that is not one of ours', () => {
    expect(deferredLinkFrom({ deeplink_url: 'https://track.tenjin.com/v0/click?x=1' })).toBeNull()
    expect(deferredLinkFrom({ url: 'not a url' })).toBeNull()
  })

  it('skips a non-GoGo value and keeps looking at later keys', () => {
    expect(
      deferredLinkFrom({ deferred_deeplink_url: 'https://example.com/promo', deep_link: CANONICAL }),
    ).toBe(CANONICAL)
  })

  it('answers null for the ordinary organic install', () => {
    expect(deferredLinkFrom({})).toBeNull()
    expect(deferredLinkFrom({ deeplink_url: '' })).toBeNull()
    expect(deferredLinkFrom({ deeplink_url: 42 as unknown as string })).toBeNull()
  })
})

describe('collecting the deferred link at startup', () => {
  it('stores a reported GoGo link', async () => {
    const remember = vi.fn().mockResolvedValue(true)
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: sdkReturning({ deferred_deeplink_url: CANONICAL }),
      store: { remember },
      report,
    })()
    expect(remember).toHaveBeenCalledWith(CANONICAL)
    expect(report).toHaveBeenCalledWith('acquisition_deferred_link_stored')
  })

  it('separates "reported" from "kept" when the store already holds one', async () => {
    // A real cold-start URL beats an attribution report. Not a lost link.
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: sdkReturning({ deeplink_url: CANONICAL }),
      store: { remember: vi.fn().mockResolvedValue(false) },
      report,
    })()
    expect(report).toHaveBeenCalledWith('acquisition_deferred_link_ignored')
  })

  it('treats an empty payload as an organic install, not a failure', async () => {
    const remember = vi.fn()
    const report = vi.fn()
    await createDeferredLinkCollector({ sdk: sdkReturning({}), store: { remember }, report })()
    expect(remember).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith('acquisition_no_deferred_link')
  })

  it('never logs the URL — a ROOM_INVITE slug is the invite code', async () => {
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: sdkReturning({ deeplink_url: INVITE }),
      store: { remember: vi.fn().mockResolvedValue(true) },
      report,
    })()
    for (const [event] of report.mock.calls) {
      expect(event).not.toContain('CODE12345')
      expect(event).not.toContain('gogo.id.vn')
    }
  })

  it('resolves when the SDK reports an error', async () => {
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: { getAttributionInfo: (_ok, fail) => fail('no referrer') },
      store: { remember: vi.fn() },
      report,
    })()
    expect(report).toHaveBeenCalledWith('acquisition_attribution_failed')
  })

  it('resolves when the SDK throws — attribution must not fail a launch', async () => {
    const report = vi.fn()
    await expect(
      createDeferredLinkCollector({
        sdk: {
          getAttributionInfo: () => {
            throw new Error('not linked')
          },
        },
        store: { remember: vi.fn() },
        report,
      })(),
    ).resolves.toBeUndefined()
    expect(report).toHaveBeenCalledWith('acquisition_attribution_unavailable')
  })

  it('resolves when storing fails', async () => {
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: sdkReturning({ deeplink_url: CANONICAL }),
      store: { remember: vi.fn().mockRejectedValue(new Error('keychain')) },
      report,
    })()
    expect(report).toHaveBeenCalledWith('acquisition_deferred_link_store_failed')
  })

  it('settles once even if the SDK calls both callbacks', async () => {
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: {
        getAttributionInfo: (ok, fail) => {
          ok({})
          fail('late error')
        },
      },
      store: { remember: vi.fn() },
      report,
    })()
    expect(report).toHaveBeenCalledTimes(1)
  })
})

describe('an SDK that answers nothing', () => {
  /**
   * DEV emulator, 2026-09-07: with no advertising id and no Play Store
   * referrer, `getAttributionInfo` completed its native retrieval and called
   * neither callback. Without a bound this promise never settles.
   */
  it('settles anyway, and says which it was', async () => {
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: { getAttributionInfo: () => {} },
      store: { remember: vi.fn() },
      report,
      timeoutMs: 5,
    })()
    expect(report).toHaveBeenCalledWith('acquisition_attribution_timed_out')
  })

  it('does not report a timeout when the SDK answered in time', async () => {
    const report = vi.fn()
    await createDeferredLinkCollector({
      sdk: sdkReturning({}),
      store: { remember: vi.fn() },
      report,
      timeoutMs: 5,
    })()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(report).toHaveBeenCalledWith('acquisition_no_deferred_link')
    expect(report).not.toHaveBeenCalledWith('acquisition_attribution_timed_out')
    expect(report).toHaveBeenCalledTimes(1)
  })
})
