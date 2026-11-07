import { afterEach, describe, expect, it, vi } from 'vitest'
import { dehydrate, hydrate, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query'
import { shouldPersistQuery } from '../persist-policy'
import { queryKeys } from '../query-keys'
import { taxonomyOptions, selectTaxonomies, type CachedTaxonomies } from '../taxonomy-cache'

const clients: QueryClient[] = []
function client() {
  const value = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(value)
  return value
}
const data = (version: number, locale = 'vi') => ({ version, kinds: {
  mood: [{ key: 'cozy', labels: { [locale]: `cozy-${version}-${locale}` } }],
  category: [{ key: 'cafe', labels: { [locale]: 'Cafe' } }],
} })
function response(version: number, locale = 'vi') {
  return new Response(JSON.stringify(data(version, locale)), {
    headers: { 'content-type': 'application/json', etag: `W/"${locale}-${version}"` },
  })
}
async function relaunch() {
  const previous = client()
  await previous.fetchQuery(taxonomyOptions(previous, 'vi'))
  const disk = JSON.parse(JSON.stringify(dehydrate(previous, {
    shouldDehydrateQuery: q => q.state.data !== undefined && shouldPersistQuery(q.queryKey),
  })))
  const next = client()
  hydrate(next, disk)
  return next
}
afterEach(() => {
  clients.splice(0).forEach(c => c.clear())
  onlineManager.setOnline(true)
  vi.unstubAllGlobals()
})

describe('persisted taxonomy launch cache', () => {
  it('renders hydrated labels immediately, makes one conditional request, and never reads a 304 body', async () => {
    const notModified = new Response(null, { status: 304, headers: { etag: 'W/"vi-1"' } })
    const readBody = vi.spyOn(notModified, 'text')
    const readJson = vi.spyOn(notModified, 'json')
    const fetcher = vi.fn().mockResolvedValueOnce(response(1)).mockResolvedValueOnce(notModified)
    vi.stubGlobal('fetch', fetcher)
    const next = await relaunch()
    const observer = new QueryObserver(next, taxonomyOptions(next, 'vi'))
    expect(observer.getCurrentResult().data?.data).toEqual(data(1))
    const stop = observer.subscribe(() => {})
    await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false))
    stop()
    // Another screen (or kind selection) must not revalidate again.
    const another = new QueryObserver(next, taxonomyOptions(next, 'vi'))
    const stopAnother = another.subscribe(() => {})
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1][1].headers).toMatchObject({
      'if-none-match': 'W/"vi-1"', 'cache-control': 'no-cache',
    })
    expect(readBody).not.toHaveBeenCalled()
    expect(readJson).not.toHaveBeenCalled()
    expect(selectTaxonomies(another.getCurrentResult().data!, 'mood').kinds).toEqual({ mood: data(1).kinds.mood })
    stopAnother()
  })

  it('replaces the version snapshot and labels when the server generation changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(1)).mockResolvedValueOnce(response(2)))
    const next = await relaunch()
    const refreshed = await next.fetchQuery(taxonomyOptions(next, 'vi'))
    expect(refreshed.data).toEqual(data(2))
    expect(next.getQueryData(queryKeys.taxonomyVersion('vi', 2))).toEqual(refreshed)
    expect(next.getQueryData(queryKeys.taxonomyVersion('vi', 1))).toBeUndefined()
  })

  it('keeps offline data successful and persisted across another relaunch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(1)).mockRejectedValue(new TypeError('offline')))
    const next = await relaunch()
    await next.fetchQuery(taxonomyOptions(next, 'vi'))
    expect(next.getQueryState(queryKeys.taxonomies('vi'))?.status).toBe('success')
    const third = client()
    hydrate(third, JSON.parse(JSON.stringify(dehydrate(next))))
    expect(third.getQueryData<CachedTaxonomies>(queryKeys.taxonomies('vi'))?.data).toEqual(data(1))
  })

  it('switches locales without sending another locale validator or leaking its labels', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(1)).mockResolvedValueOnce(response(1, 'en'))
    vi.stubGlobal('fetch', fetcher)
    const next = await relaunch()
    expect(next.getQueryData(queryKeys.taxonomies('en'))).toBeUndefined()
    const en = await next.fetchQuery(taxonomyOptions(next, 'en'))
    expect(fetcher.mock.calls[1][0]).toContain('locale=en')
    expect(fetcher.mock.calls[1][1].headers['if-none-match']).toBeUndefined()
    expect(en.data).toEqual(data(1, 'en'))
    expect(next.getQueryData<CachedTaxonomies>(queryKeys.taxonomies('vi'))?.data).toEqual(data(1))
  })

  it('revalidates Vietnamese on return after English discovers a newer global generation', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce(response(2, 'en')).mockResolvedValueOnce(response(2))
    vi.stubGlobal('fetch', fetcher)
    const next = client()
    await next.fetchQuery(taxonomyOptions(next, 'vi'))
    await next.fetchQuery(taxonomyOptions(next, 'en'))
    // Keep the old locale available until its replacement arrives.
    expect(next.getQueryData<CachedTaxonomies>(queryKeys.taxonomies('vi'))?.data).toEqual(data(1))
    const observer = new QueryObserver(next, taxonomyOptions(next, 'vi'))
    const stop = observer.subscribe(() => {})
    try {
      await vi.waitFor(() => expect(observer.getCurrentResult().data?.data).toEqual(data(2)))
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(fetcher.mock.calls[2][1].headers['if-none-match']).toBe('W/"vi-1"')
      expect(next.getQueryData(queryKeys.taxonomyVersion('vi', 1))).toBeUndefined()
    } finally {
      stop()
    }
  })

  it('retains an outdated locale offline and retries it on next use after a known generation change', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce(response(2, 'en')).mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(2))
    vi.stubGlobal('fetch', fetcher)
    const next = client()
    await next.fetchQuery(taxonomyOptions(next, 'vi'))
    await next.fetchQuery(taxonomyOptions(next, 'en'))
    const fallback = await next.fetchQuery(taxonomyOptions(next, 'vi'))
    expect(fallback.data).toEqual(data(1))
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(next.getQueryState(queryKeys.taxonomies('vi'))?.status).toBe('success')
    expect((await next.fetchQuery(taxonomyOptions(next, 'vi'))).data).toEqual(data(2))
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('does not validate an older offline fallback when delayed hydration reveals a newer generation', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(response(2))
    vi.stubGlobal('fetch', fetcher)
    const next = client()
    const optionsBeforeHydration = taxonomyOptions(next, 'vi')
    const previous = client()
    previous.setQueryData(queryKeys.taxonomies('vi'), { data: data(1), etag: 'W/"vi-1"' })
    previous.setQueryData(queryKeys.taxonomies('en'), { data: data(2, 'en'), etag: 'W/"en-2"' })
    hydrate(next, JSON.parse(JSON.stringify(dehydrate(previous))))
    expect((await next.fetchQuery(optionsBeforeHydration)).data).toEqual(data(1))
    expect((await next.fetchQuery(taxonomyOptions(next, 'vi'))).data).toEqual(data(2))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('renders cache without a request when the device is known offline', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(1))
    vi.stubGlobal('fetch', fetcher)
    const next = await relaunch()
    onlineManager.setOnline(false)
    const observer = new QueryObserver(next, taxonomyOptions(next, 'vi'))
    const stop = observer.subscribe(() => {})
    expect(observer.getCurrentResult().data?.data).toEqual(data(1))
    expect(observer.getCurrentResult().fetchStatus).toBe('paused')
    expect(fetcher).toHaveBeenCalledTimes(1)
    stop()
    await next.cancelQueries()
  })

  it('keeps data for an unchanged generation and preserves kind filter semantics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(1)).mockResolvedValueOnce(response(1)))
    const next = await relaunch()
    const cached = next.getQueryData<CachedTaxonomies>(queryKeys.taxonomies('vi'))!
    const refreshed = await next.fetchQuery(taxonomyOptions(next, 'vi'))
    expect(refreshed.data).toBe(cached.data)
    expect(selectTaxonomies(refreshed, '').kinds).toEqual(data(1).kinds)
    expect(selectTaxonomies(refreshed, '  , ').kinds).toEqual({})
    expect(selectTaxonomies(refreshed, 'unknown').kinds).toEqual({})
    expect(selectTaxonomies(refreshed, ' mood,mood ').kinds).toEqual({ mood: data(1).kinds.mood })
  })

  it('does not share a request across locales, but deduplicates simultaneous consumers', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(1))
    vi.stubGlobal('fetch', fetcher)
    const next = client()
    await Promise.all([next.fetchQuery(taxonomyOptions(next, 'vi')), next.fetchQuery(taxonomyOptions(next, 'vi'))])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
