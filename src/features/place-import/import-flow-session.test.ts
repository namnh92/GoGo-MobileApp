import { afterEach, expect, it, vi } from 'vitest'
import { currentAccessGrant } from '@/shared/api/client'
import { deleteContributionDraft, getContributionDraft, listContributionDrafts, saveContributionDraft } from '@/shared/api/endpoints/contribution-drafts'
import { resolveGoogleMapsLink, submitPlace } from '@/shared/api/endpoints/places'
import { beginSessionEnd, captureSessionScope, clearSession, getSession, getSessionGeneration, persistSession, type Session } from '@/shared/api/session'
import { ImportFlowController, initialImportFlow } from './import-flow'
import type { ContributionDraft } from './contribution-form'

const A: Session = { kind: 'user', userId: 'A', accessToken: 'access-A', refreshToken: 'refresh-A', expiresAt: Date.now() + 600_000 }
const B: Session = { ...A, userId: 'B', accessToken: 'access-B', refreshToken: 'refresh-B' }
const guest: Session = { kind: 'guest', roomId: 'room-A', accessToken: 'guest-A', guestToken: 'opaque-A', expiresAt: A.expiresAt }
const draft: ContributionDraft = { id: 'draft-A', googlePlaceId: 'place-A', version: 3,
  enrichment: { purposeKeys: ['couple'], vibeKeys: ['festive'], visitTips: 'private A', photos: [{ mediaId: 'bill-A', kind: 'bill' }], billPhotoPublicConsent: true },
  verificationStatus: 'unverified', updatedAt: '2026-11-07T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z' }
const resolution = { status: 'RESOLVED' as const, candidate: { googlePlaceId: 'place-A', name: 'A preview' }, resolutionToken: 'proof-A' }
const accepted = { status: 'PENDING', submissionId: 'submission-A' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const flows: ImportFlowController[] = []
function setup() {
  const flow = new ImportFlowController({ uuid: () => 'new-A', now: Date.now,
    list: listContributionDrafts, read: getContributionDraft, save: ({ id, body }) => saveContributionDraft(id, body),
    remove: ({ id, version }) => deleteContributionDraft(id, version), submit: submitPlace, resolve: resolveGoogleMapsLink, report: vi.fn() })
  flows.push(flow); flow.mount(); flow.configure(true, true)
  flow.resolved(resolution, 'https://maps.app.goo.gl/A')
  flow.dispatch({ type: 'INSTALL', draft, message: 'resumed' })
  flow.move(3)
  return flow
}
afterEach(async () => { for (const flow of flows.splice(0)) flow.dispose(); vi.restoreAllMocks(); await clearSession() })

const transitions = ['logout', 'switch', 'A-B-A', 'guest-user', 'expiry'] as const
const stages = ['resolve', 'resume', 'create', 'save', 'delete', 'list', 'submit', 'proof retry', 'cleanup', 'delete probe', 'save probe', 'list probe'] as const
for (const transition of transitions) {
  it.each(stages)(`T13 ${transition} during %s resets all private flow state and cancels real transport work`, async stage => {
    await persistSession(transition === 'guest-user' ? guest : A)
    const flow = setup()
    const reply = deferred<Response>()
    const fetch = vi.spyOn(globalThis, 'fetch')
    let late = json(draft)
    if (stage === 'proof retry') fetch.mockResolvedValueOnce(json({ code: 'RESOLUTION_TOKEN_INVALID' }, 400))
    if (stage === 'cleanup') { fetch.mockResolvedValueOnce(json(accepted)); late = json({ deleted: true }) }
    if (stage === 'delete probe') fetch.mockResolvedValueOnce(json({ code: 'NOT_FOUND' }, 404))
    if (stage === 'list probe') fetch.mockResolvedValueOnce(json({ items: [] }))
    fetch.mockImplementationOnce(() => reply.promise)
    let work: Promise<unknown>
    if (stage === 'resolve') {
      const ticket = flow.startResolution('https://maps.app.goo.gl/A')!
      work = resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/A' }).then(result => {
        if (flow.current(ticket)) flow.resolved(result, 'https://maps.app.goo.gl/A')
      }, () => flow.resolutionFailed(ticket))
      late = json(resolution)
    } else if (stage === 'resume') work = flow.resume(draft.id)
    else if (stage === 'save' || stage === 'create') {
      if (stage === 'create') flow.startNew()
      work = flow.save()
    } else if (stage === 'delete' || stage === 'delete probe') work = flow.deleteDraft()
    else if (stage === 'list' || stage === 'list probe') { work = flow.refreshList(); if (stage === 'list') late = json({ items: [draft] }) }
    else if (stage === 'save probe') {
      flow.dispatch({ type: 'PATCH', value: { pendingCreate: { id: draft.id, request: { googlePlaceId: draft.googlePlaceId, expectedVersion: 3, enrichment: draft.enrichment }, uncertain: true, inputRevision: 0 } } })
      work = flow.reconcileSave()
    } else { work = flow.submit(); late = json(stage === 'proof retry' ? resolution : stage === 'cleanup' ? { deleted: true } : accepted) }
    const calls = ['proof retry', 'cleanup', 'delete probe', 'list probe'].includes(stage) ? 2 : 1
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(calls))
    const signal = fetch.mock.calls[calls - 1][1]?.signal
    const oldTicket = flow.capture()
    const oldEpoch = flow.getSnapshot().sessionEpoch
    if (transition === 'logout') beginSessionEnd()
    else if (transition === 'expiry') {
      fetch.mockResolvedValueOnce(json({ code: 'SESSION_REVOKED' }, 401))
      await currentAccessGrant({ force: true })
    } else {
      await persistSession(B)
      if (transition === 'A-B-A') await persistSession(A)
    }
    const expected = getSessionGeneration()
    expect(expected).toBeGreaterThan(oldEpoch)
    expect(signal?.aborted).toBe(true)
    expect(flow.getSnapshot()).toEqual(initialImportFlow(flow.getSnapshot().flowGeneration, expected))
    expect(flow.current(oldTicket)).toBe(false)
    const blank = flow.getSnapshot()
    // A transport which ignores AbortSignal can still return success or 401.
    reply.resolve(late)
    await work
    expect(flow.getSnapshot()).toBe(blank)
    expect(fetch).toHaveBeenCalledTimes(calls + (transition === 'expiry' ? 1 : 0))
    expect(getSession()?.userId).toBe(transition === 'expiry' ? undefined : transition === 'logout' || transition === 'A-B-A' ? 'A' : 'B')
  })
}

it('same-account token renewal preserves fields, media, acknowledgement and flow epoch', async () => {
  await persistSession(A)
  const flow = setup()
  const before = flow.getSnapshot()
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ userId: 'A', accessToken: 'renewed-A', refreshToken: 'rotated-A', expiresIn: 900 }))
  await currentAccessGrant({ force: true })
  expect(flow.getSnapshot()).toBe(before)
  expect(flow.getSnapshot().sessionEpoch).toBe(getSessionGeneration())
})

it('remount catches a missed session transition and disposal removes the subscription', async () => {
  await persistSession(A)
  const flow = setup()
  flow.dispose()
  const disposed = flow.getSnapshot()
  await persistSession(B)
  expect(flow.getSnapshot()).toBe(disposed)
  flow.mount()
  expect(flow.getSnapshot()).toEqual(initialImportFlow(flow.getSnapshot().flowGeneration, getSessionGeneration()))
})

it('rejects flow tickets during synchronous transport abort, before session subscribers run', async () => {
  await persistSession(A)
  const flow = setup()
  const ticket = flow.capture()
  let validDuringAbort: boolean | undefined
  captureSessionScope().signal.addEventListener('abort', () => { validDuringAbort = flow.current(ticket) }, { once: true })
  beginSessionEnd()
  expect(validDuringAbort).toBe(false)
})

it('draft deletion passes path and version as request options and sends no body', async () => {
  await persistSession(A)
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ deleted: true }))
  await deleteContributionDraft(draft.id, draft.version)
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/place-contribution-drafts/${draft.id}?version=3`), expect.objectContaining({ method: 'DELETE', body: undefined }))
})

it('same-account 401 refresh replays a wizard save without resetting its lifetime or media', async () => {
  await persistSession(A)
  const flow = setup()
  const epoch = flow.getSnapshot().sessionEpoch
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ code: 'UNAUTHORIZED' }, 401))
    .mockResolvedValueOnce(json({ userId: 'A', accessToken: 'renewed-A', refreshToken: 'rotated-A', expiresIn: 900 }))
    .mockResolvedValueOnce(json({ ...draft, version: 4 }))
    .mockResolvedValueOnce(json({ items: [{ ...draft, version: 4 }] }))
  await flow.save()
  expect(flow.getSnapshot()).toMatchObject({ sessionEpoch: epoch, draft: { id: draft.id, version: 4 }, media: draft.enrichment.photos })
  expect(fetch.mock.calls[2][1]?.headers).toMatchObject({ authorization: 'Bearer renewed-A' })
  expect(JSON.parse(fetch.mock.calls[2][1]?.body as string).enrichment).toEqual(draft.enrichment)
})
