import { describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError, TimeoutError } from '@/shared/api/errors'
import { ImportFlowController, acknowledgementValid, serializeFlow, type FlowDependencies } from './import-flow'
import type { ContributionDraft } from './contribution-form'
const media = [{ mediaId: 'menu', kind: 'menu' as const }, { mediaId: 'bill', kind: 'bill' as const }]
const draft: ContributionDraft = { id: 'draft-a', googlePlaceId: 'place-a', version: 3,
  enrichment: { purposeKeys: ['couple'], vibeKeys: ['festive'], visitTips: 'server', photos: media, billPhotoPublicConsent: true },
  verificationStatus: 'unverified', updatedAt: '2026-11-07T00:00:00Z', expiresAt: '2026-12-07T00:00:00Z' }
const error = (status: number, code: string, field?: string) => new ApiError(status, { code, message: 'private server message', field_errors: field ? [{ field, code, message: 'private' }] : [] })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function setup() {
  const deps = {
    uuid: vi.fn(() => 'new-uuid'), now: vi.fn(() => Date.parse('2026-11-07T12:00:00Z')),
    list: vi.fn(async () => ({ items: [draft] })), read: vi.fn(async () => draft),
    save: vi.fn<FlowDependencies['save']>(async ({ id, body }) => ({ ...draft, id, enrichment: body.enrichment, version: body.expectedVersion + 1 })),
    remove: vi.fn<FlowDependencies['remove']>(async () => ({ deleted: true })),
    submit: vi.fn<FlowDependencies['submit']>(async () => ({ status: 'PENDING', submissionId: 'submission-a' })),
    resolve: vi.fn<FlowDependencies['resolve']>(async () => ({ status: 'RESOLVED', candidate: { googlePlaceId: 'place-a' }, resolutionToken: 'fresh-proof' })),
    report: vi.fn(),
  }
  const flow = new ImportFlowController(deps)
  flow.registered = true; flow.selectPlace('place-a')
  return { flow, deps, state: flow.getSnapshot }
}
async function resumed() { const ctx = setup(); await ctx.flow.resume(draft.id); return ctx }
const detached = (flow: ImportFlowController) => {
  const s = flow.getSnapshot()
  expect(s).toMatchObject({ draft: null, pendingCreate: null, media: [], acknowledgement: null, conflict: null, captured: null })
  expect(serializeFlow(s)).not.toHaveProperty('photos')
  expect(serializeFlow(s)).not.toHaveProperty('billPhotoPublicConsent')
}
describe('SA lifecycle matrix T1-T12', () => {
  it('T1 blank create has no identity/media/consent or server calls', () => {
    const { state, deps } = setup()
    expect(state()).toMatchObject({ phase: 'editing', draft: null, pendingCreate: null, media: [], acknowledgement: null, message: 'newDraft' })
    expect(deps.read).not.toHaveBeenCalled(); expect(deps.save).not.toHaveBeenCalled()
  })
  it('M01 T2/T4 resume -> edit -> save round trips media/explicit acknowledgement and returned version', async () => {
    const { flow, deps, state } = await resumed()
    flow.edit({ visitTips: 'local edit' }); await flow.save()
    expect(deps.save).toHaveBeenCalledWith({ id: draft.id, body: { googlePlaceId: 'place-a', expectedVersion: 3, enrichment: { ...draft.enrichment, visitTips: 'local edit' } } })
    expect(state().draft?.version).toBe(4); expect(acknowledgementValid(state())).toBe(true)
    expect(state().fields).not.toHaveProperty('photos')
    expect(state().fields).not.toHaveProperty('billPhotoPublicConsent')
  })
  it('M02 replacing/removing bills resets exact-set acknowledgement; menu changes do not', async () => {
    const { flow, deps, state } = await resumed()
    flow.setMedia([...media, { mediaId: 'menu-2', kind: 'menu' }]); expect(acknowledgementValid(state())).toBe(true)
    flow.setMedia([{ mediaId: 'bill-2', kind: 'bill' }]); expect(acknowledgementValid(state())).toBe(false)
    await flow.save(); await flow.submit(); expect(deps.save).not.toHaveBeenCalled(); expect(deps.submit).not.toHaveBeenCalled()
    flow.acknowledge(); expect(acknowledgementValid(state())).toBe(true)
    flow.setMedia([]); expect(serializeFlow(state())).not.toHaveProperty('billPhotoPublicConsent')
  })
  it('M02 missing returned acknowledgement is never inferred; consent field errors retain media', async () => {
    const { flow, deps, state } = setup()
    deps.read.mockResolvedValueOnce({ ...draft, enrichment: { ...draft.enrichment, billPhotoPublicConsent: undefined } })
    await flow.resume(draft.id); await flow.save(); await flow.submit(); expect(deps.save).not.toHaveBeenCalled(); expect(deps.submit).not.toHaveBeenCalled()
    flow.acknowledge(); deps.save.mockRejectedValueOnce(error(400, 'VALIDATION_FAILED', 'enrichment.billPhotoPublicConsent'))
    await flow.save(); expect(state().media).toEqual(media); expect(state().acknowledgement).toBeNull()
    expect(state().message).toBe('billAcknowledgementRequired')
  })
  it('M03 active GET 404 atomically detaches before later save/submit', async () => {
    const { flow, deps, state } = await resumed()
    flow.edit({ visitTips: 'keep' }); deps.read.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    await flow.resume(draft.id); detached(flow); expect(state().fields.visitTips).toBe('keep')
    deps.list.mockResolvedValue({ items: [{ ...draft, id: 'new-uuid', version: 1, enrichment: { purposeKeys: ['couple'], vibeKeys: ['festive'], visitTips: 'keep' } }] })
    await flow.save(); await flow.refreshList(); expect(deps.save.mock.calls[0][0]).toMatchObject({ id: 'new-uuid', body: { expectedVersion: 0 } })
    await flow.submit(); expect(deps.submit.mock.calls[0][0].enrichment).not.toHaveProperty('photos')
  })
  it('M04 resuming another missing draft tombstones only that row and preserves the current snapshot', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' })
    const before = state(); deps.read.mockRejectedValueOnce(error(404, 'NOT_FOUND')); await flow.resume('other')
    expect(state()).toMatchObject({ draft: before.draft, fields: before.fields, media: before.media, acknowledgement: before.acknowledgement })
    expect(state().tombstones).toContain('other')
  })
  it('T2 replacement requires explicit confirmation and rejects mismatched place/id', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'dirty' })
    deps.read.mockResolvedValueOnce({ ...draft, id: 'other', googlePlaceId: 'wrong-place' })
    await flow.requestResume('other'); expect(state().replacement).toBe('other'); expect(deps.read).toHaveBeenCalledTimes(1)
    await flow.confirmReplacement(); expect(state().fields.visitTips).toBe('dirty'); expect(state().draft?.id).toBe(draft.id)
    deps.read.mockResolvedValueOnce({ ...draft, id: 'other', enrichment: { purposeKeys: ['group'] } })
    await flow.resume('other'); expect(state().media).toEqual([]); expect(state().acknowledgement).toBeNull(); expect(state().step).toBe(1)
  })
  it('M05 deleting active detaches; deleting another row preserves active form/media/ack', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' })
    const before = state(); await flow.deleteDraft({ id: 'other', version: 7 })
    expect(state()).toMatchObject({ draft: before.draft, fields: before.fields, media: media, acknowledgement: before.acknowledgement })
    await flow.deleteDraft(); detached(flow); expect(state().fields.visitTips).toBe('keep')
    expect(deps.remove.mock.calls).toEqual([[{ id: 'other', version: 7 }], [{ id: draft.id, version: 3 }]])
  })
  it('T7 local discard never calls DELETE; uncertain create must GET first', async () => {
    const { flow, deps, state } = setup(); flow.edit({ visitTips: 'keep' }); await flow.deleteDraft()
    expect(deps.remove).not.toHaveBeenCalled(); expect(state().fields.visitTips).toBe('keep')
    deps.save.mockRejectedValueOnce(new TimeoutError(1)); await flow.save()
    deps.read.mockResolvedValueOnce({ ...draft, id: 'new-uuid', enrichment: { visitTips: 'keep' }, version: 1 })
    await flow.deleteDraft(); expect(deps.read).toHaveBeenCalledWith('new-uuid'); expect(deps.remove).not.toHaveBeenCalled()
    expect(state().draft?.id).toBe('new-uuid')
  })
  it.each([200, 404])('M06 DELETE 404 -> GET %i never auto-deletes a newly discovered version', async status => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' })
    deps.remove.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    if (status === 200) deps.read.mockResolvedValueOnce({ ...draft, version: 4 })
    else deps.read.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    await flow.deleteDraft(); expect(deps.remove).toHaveBeenCalledTimes(1)
    if (status === 200) { expect(state()).toMatchObject({ phase: 'conflict', conflict: { id: draft.id, version: 4 } }); await flow.save(); await flow.submit(); expect(deps.save).not.toHaveBeenCalled(); expect(deps.submit).not.toHaveBeenCalled() }
    else detached(flow)
    expect(state().fields.visitTips).toBe('keep')
  })
  it('M07 active expiry detaches without a list and ignores in-flight save completion', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' })
    const slow = deferred<ContributionDraft>(); deps.save.mockReturnValueOnce(slow.promise); const saving = flow.save()
    deps.now.mockReturnValue(Date.parse(draft.expiresAt)); flow.expireActive(); detached(flow)
    slow.resolve({ ...draft, version: 4 }); await saving; detached(flow); expect(state().fields.visitTips).toBe('keep')
  })
  it('M07 list omission GET checks presence without replacing dirty inputs', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' }); deps.list.mockResolvedValueOnce({ items: [] })
    await flow.refreshList(); expect(deps.read).toHaveBeenCalledTimes(2); expect(state().fields.visitTips).toBe('keep'); expect(state().media).toEqual(media)
    deps.list.mockResolvedValueOnce({ items: [] }); deps.read.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    await flow.refreshList(); detached(flow)
  })
  it('T9 newer listed version quarantines writes without replacing edits', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' }); deps.list.mockResolvedValueOnce({ items: [{ ...draft, version: 8 }] })
    await flow.refreshList(); expect(state()).toMatchObject({ phase: 'conflict', fields: { visitTips: 'keep' } }); await flow.submit(); expect(deps.submit).not.toHaveBeenCalled()
  })
  it('M08 freezes a save snapshot, serializes repeated taps and ignores old-generation completion', async () => {
    const { flow, deps, state } = await resumed()
    const slow = deferred<ContributionDraft>(); deps.save.mockReturnValueOnce(slow.promise)
    flow.edit({ visitTips: 'frozen' }); const saving = flow.save(); await flow.save(); await flow.submit(); flow.edit({ visitTips: 'illegal edit' })
    expect(state().fields.visitTips).toBe('frozen'); expect(deps.save).toHaveBeenCalledTimes(1); expect(deps.submit).not.toHaveBeenCalled()
    flow.reset('new-link'); flow.selectPlace('place-b'); slow.resolve({ ...draft, version: 4 }); await saving
    expect(state()).toMatchObject({ googlePlaceId: 'place-b', draft: null, media: [], captured: null, fields: { visitTips: '' } })
    expect(deps.report).not.toHaveBeenCalledWith('place_contribution_draft_saved')
  })
  it('M08 conflict start-new uses atomic detach, preserves fields, never deletes remote draft', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' }); deps.save.mockRejectedValueOnce(error(409, 'DRAFT_MODIFIED'))
    await flow.save(); await flow.submit(); expect(deps.submit).not.toHaveBeenCalled(); flow.startNew(); detached(flow)
    expect(state().fields.visitTips).toBe('keep'); expect(deps.remove).not.toHaveBeenCalled()
  })
  it.each(['save', 'submit'] as const)('M09 invalid media on %s is removed before any retry; draft/fields survive', async operation => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' }); deps[operation].mockRejectedValueOnce(error(400, 'INVALID_UPLOAD_KEY'))
    await flow[operation](); expect(state()).toMatchObject({ phase: 'mediaRecovery', draft: { id: draft.id, version: 3 }, media: [], acknowledgement: null, captured: null })
    flow.continueWithoutPhotos(); await flow.save(); expect(deps.save.mock.lastCall?.[0].body.enrichment).not.toHaveProperty('photos'); expect(state().fields.visitTips).toBe('keep')
  })
  it.each(['INVALID_SUBMISSION_PHOTOS', 'VALIDATION_FAILED'])('T6 handles %s and documented media field errors', async code => {
    const { flow, deps, state } = await resumed(); deps.save.mockRejectedValueOnce(error(400, code, 'enrichment.photos.0.mediaId'))
    await flow.save(); expect(state().phase).toBe('mediaRecovery'); expect(state().media).toEqual([])
  })
  it('M10 timeout after server commit reconciles same UUID/request before further writes, without duplicate create', async () => {
    const { flow, deps, state } = setup(); flow.edit({ visitTips: 'frozen' }); deps.save.mockRejectedValueOnce(new TimeoutError(10)); await flow.save()
    const pending = state().pendingCreate!; expect(pending.id).toBe('new-uuid'); flow.edit({ visitTips: 'later' })
    deps.read.mockResolvedValueOnce({ ...draft, id: pending.id, enrichment: pending.request.enrichment, version: 1 }); await flow.save()
    expect(deps.read).toHaveBeenCalledWith(pending.id); expect(deps.save).toHaveBeenCalledTimes(1); expect(deps.uuid).toHaveBeenCalledTimes(1)
    expect(state().draft?.version).toBe(1); expect(state().fields.visitTips).toBe('later'); expect(state().dirty).toBe(true)
  })
  it.each(['create', 'update'] as const)('F-09 uncertain %s reconciliation preserves later text and bill removal until explicit replacement', async kind => {
    const { flow, deps, state } = kind === 'update' ? await resumed() : setup()
    if (kind === 'create') { flow.setMedia(media); flow.acknowledge() }
    flow.edit({ visitTips: 'frozen' }); deps.save.mockRejectedValueOnce(new TimeoutError(10)); await flow.save()
    const pending = state().pendingCreate!
    const committed = { ...draft, id: pending.id, version: kind === 'create' ? 1 : 4, enrichment: pending.request.enrichment }
    flow.edit({ visitTips: 'later' }); flow.setMedia([media[0]])
    deps.read.mockResolvedValue(committed); await flow.reconcileSave()
    expect(state()).toMatchObject({ phase: 'editing', draft: { id: committed.id, version: committed.version }, pendingCreate: null, fields: { visitTips: 'later' }, media: [media[0]], acknowledgement: null, dirty: true })
    expect(serializeFlow(state())).not.toHaveProperty('billPhotoPublicConsent')
    await flow.requestResume(committed.id)
    expect(state().replacement).toBe(committed.id); expect(deps.read).toHaveBeenCalledTimes(kind === 'create' ? 1 : 2)
    flow.cancelReplacement(); expect(state().fields.visitTips).toBe('later'); expect(state().media).toEqual([media[0]])
    await flow.requestResume(committed.id); await flow.confirmReplacement()
    expect(state().fields.visitTips).toBe('frozen'); expect(state().media).toEqual(media); expect(acknowledgementValid(state())).toBe(true)
  })
  it.each(['create', 'update'] as const)('F-10 reconciled uncertain %s conflict allows start-new and a fresh save without deleting remote data', async kind => {
    const { flow, deps, state } = kind === 'update' ? await resumed() : setup()
    flow.edit({ visitTips: 'keep' }); deps.save.mockRejectedValueOnce(new NetworkError()); await flow.save()
    const pending = state().pendingCreate!
    deps.read.mockResolvedValueOnce({ ...draft, id: pending.id, version: 8 })
    await flow.reconcileSave(); expect(state()).toMatchObject({ phase: 'conflict', conflict: { id: pending.id, version: 8 }, pendingCreate: null })
    flow.startNew(); detached(flow); expect(state().fields.visitTips).toBe('keep')
    deps.uuid.mockReturnValueOnce('fresh-uuid'); await flow.save()
    expect(deps.save).toHaveBeenLastCalledWith({ id: 'fresh-uuid', body: { googlePlaceId: 'place-a', expectedVersion: 0, enrichment: { visitTips: 'keep', ...(kind === 'update' ? { purposeKeys: ['couple'], vibeKeys: ['festive'] } : {}) } } })
    expect(deps.remove).not.toHaveBeenCalled()
  })
  it('F-09 confirmation also protects form edits omitted from the wire payload', async () => {
    const { flow, deps, state } = await resumed()
    deps.save.mockRejectedValueOnce(new TimeoutError(1)); await flow.save()
    const pending = state().pendingCreate!
    flow.edit({ min: '123', visitTips: 'server ' }) // Unknown price and trimmed text serialize identically.
    deps.read.mockResolvedValueOnce({ ...draft, version: 4, enrichment: pending.request.enrichment })
    await flow.reconcileSave(); await flow.requestResume(draft.id)
    expect(state()).toMatchObject({ dirty: true, replacement: draft.id, fields: { min: '123', visitTips: 'server ' } })
    expect(deps.read).toHaveBeenCalledTimes(2)
  })
  it.each(['create', 'update'] as const)('uncertain %s GET without later edits confirms saved identity without marking dirty', async kind => {
    const { flow, deps, state } = kind === 'update' ? await resumed() : setup()
    deps.save.mockRejectedValueOnce(new TimeoutError(1)); await flow.save()
    const pending = state().pendingCreate!
    deps.read.mockResolvedValueOnce({ ...draft, id: pending.id, enrichment: pending.request.enrichment })
    await flow.reconcileSave(); expect(state()).toMatchObject({ dirty: false, pendingCreate: null, phase: 'editing' })
  })
  it.each(['404', 'expired', 'network', 'foreign'] as const)('uncertain create GET %s preserves inputs and never blindly writes or detaches uncertainty', async outcome => {
    const { flow, deps, state } = setup(); flow.edit({ visitTips: 'keep' }); flow.setMedia(media); flow.acknowledge()
    deps.save.mockRejectedValueOnce(new TimeoutError(1)); await flow.save()
    const pending = state().pendingCreate!
    flow.setMedia([media[0]])
    if (outcome === '404') deps.read.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    else if (outcome === 'network') deps.read.mockRejectedValueOnce(new NetworkError())
    else deps.read.mockResolvedValueOnce({ ...draft, id: pending.id, ...(outcome === 'foreign' ? { googlePlaceId: 'foreign' } : { expiresAt: '2020-01-01T00:00:00Z' }) })
    await flow.reconcileSave(); expect(state().fields.visitTips).toBe('keep'); expect(deps.save).toHaveBeenCalledTimes(1)
    if (outcome === '404' || outcome === 'expired') { detached(flow); expect(state().tombstones).toContain(pending.id) }
    else { expect(state().pendingCreate).toEqual(pending); expect(state().phase).toBe('editing'); flow.startNew(); expect(state().pendingCreate).toEqual(pending) }
  })
  it('F-10 list reconciliation cannot strand an uncertain update in a non-detachable conflict', async () => {
    const { flow, deps, state } = await resumed()
    flow.edit({ visitTips: 'keep' }); deps.save.mockRejectedValueOnce(new TimeoutError(1)); await flow.save()
    deps.list.mockResolvedValueOnce({ items: [{ ...draft, version: 8 }] }); deps.read.mockResolvedValueOnce({ ...draft, version: 8 })
    await flow.refreshList(); expect(state()).toMatchObject({ phase: 'conflict', pendingCreate: null })
    expect(deps.read).toHaveBeenCalledTimes(2)
    flow.startNew(); detached(flow); expect(deps.remove).not.toHaveBeenCalled()
  })
  it.each(['404', 'expired'] as const)('F-10 reconciled create conflict reload %s detaches all ownership and returns to editing', async outcome => {
    const { flow, deps, state } = setup(); flow.edit({ visitTips: 'keep' }); flow.setMedia(media); flow.acknowledge()
    deps.save.mockRejectedValueOnce(new TimeoutError(1)); await flow.save()
    deps.read.mockResolvedValueOnce({ ...draft, id: 'new-uuid', version: 8 }); await flow.reconcileSave()
    if (outcome === '404') deps.read.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    else deps.read.mockResolvedValueOnce({ ...draft, id: 'new-uuid', expiresAt: '2020-01-01T00:00:00Z' })
    await flow.requestResume('new-uuid'); await flow.confirmReplacement(); detached(flow)
    expect(state()).toMatchObject({ phase: 'editing', fields: { visitTips: 'keep' } })
  })
  it('DELETE mismatch -> expired GET detaches active ownership without deleting the discovered version', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' })
    deps.remove.mockRejectedValueOnce(error(404, 'NOT_FOUND')); deps.read.mockResolvedValueOnce({ ...draft, version: 8, expiresAt: '2020-01-01T00:00:00Z' })
    await flow.deleteDraft(); detached(flow); expect(state()).toMatchObject({ phase: 'editing', fields: { visitTips: 'keep' } })
    expect(deps.remove).toHaveBeenCalledTimes(1)
  })
  it('T4 uncertain update differing from frozen payload requires conflict review', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'frozen' }); deps.save.mockRejectedValueOnce(new NetworkError()); await flow.save(); await flow.save()
    expect(state().phase).toBe('conflict'); expect(deps.save).toHaveBeenCalledTimes(1); expect(state().fields.visitTips).toBe('frozen')
  })
  it('M11 accepted submit retires BEFORE cleanup awaits and never sends media-delete requests', async () => {
    const { flow, deps, state } = await resumed(); const slow = deferred<unknown>(); deps.remove.mockReturnValueOnce(slow.promise)
    const submitting = flow.submit(); await Promise.resolve(); await Promise.resolve()
    expect(state()).toMatchObject({ phase: 'retiring', draft: null, media: [], acknowledgement: null, captured: null, cleanup: { id: draft.id, version: 3 }, result: { submissionId: 'submission-a' } })
    expect(state().tombstones).toContain(draft.id); expect(state().list.some(d => d.id === draft.id)).toBe(false)
    await flow.submit(); await flow.retryCleanup(); expect(deps.submit).toHaveBeenCalledTimes(1); expect(deps.remove).toHaveBeenCalledTimes(1)
    slow.resolve({ deleted: true }); await submitting; expect(state().phase).toBe('completed')
  })
  it('M11 cleanup failure retains successful result and retries cleanup without resubmission', async () => {
    const { flow, deps, state } = await resumed(); deps.remove.mockRejectedValueOnce(new NetworkError()); await flow.submit()
    expect(state()).toMatchObject({ phase: 'retiring', message: 'submittedCleanupPending', result: { submissionId: 'submission-a' } }); detached(flow)
    await flow.refreshList(); expect(state().list).toEqual([])
    await flow.submit(); await flow.retryCleanup(); expect(state().phase).toBe('completed'); expect(deps.submit).toHaveBeenCalledTimes(1)
    expect(deps.remove.mock.calls).toEqual([[{ id: draft.id, version: 3 }], [{ id: draft.id, version: 3 }]])
  })
  it.each([200, 404])('M11 cleanup DELETE 404 -> GET %i requires review or completes on proven absence', async status => {
    const { flow, deps, state } = await resumed(); deps.remove.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    if (status === 404) deps.read.mockRejectedValueOnce(error(404, 'NOT_FOUND'))
    else deps.read.mockResolvedValueOnce({ ...draft, version: 8 })
    await flow.submit(); await flow.retryCleanup(); expect(deps.submit).toHaveBeenCalledTimes(1); expect(deps.remove).toHaveBeenCalledTimes(1)
    if (status === 404) expect(state().phase).toBe('completed')
    else {
      expect(state()).toMatchObject({ phase: 'retiring', cleanup: { id: draft.id, version: 3, changedVersion: 8 } })
      await flow.deleteReviewedCleanup(); expect(deps.remove).toHaveBeenCalledTimes(1)
      flow.reviewChangedCleanup(); await flow.deleteReviewedCleanup(); expect(deps.remove).toHaveBeenLastCalledWith({ id: draft.id, version: 8 })
    }
  })
  it('M12 lost POST response quarantines submitted snapshot with no replay or cleanup', async () => {
    const { flow, deps, state } = await resumed(); deps.submit.mockRejectedValueOnce(new TimeoutError(1)); await flow.submit()
    expect(state()).toMatchObject({ phase: 'submissionUnknown', message: 'submissionUnconfirmed', draft: { id: draft.id }, media })
    expect(state().captured).toBeTruthy(); await flow.submit(); await flow.save(); await flow.deleteDraft(); flow.startNew()
    expect(state().phase).toBe('submissionUnknown'); expect(deps.submit).toHaveBeenCalledTimes(1); expect(deps.remove).not.toHaveBeenCalled(); expect(deps.save).not.toHaveBeenCalled()
  })
  it('M12 ALREADY_EXISTS without accepted contribution retains all ownership', async () => {
    const { flow, deps, state } = await resumed(); deps.submit.mockResolvedValueOnce({ status: 'ALREADY_EXISTS', placeId: 'canonical' }); await flow.submit()
    expect(state()).toMatchObject({ phase: 'editing', message: 'alreadyExists', draft: { id: draft.id }, media, captured: null }); expect(acknowledgementValid(state())).toBe(true)
    expect(deps.remove).not.toHaveBeenCalled()
  })
  it('T12 known rejection and draft limit preserve fields/media/acknowledgement', async () => {
    const { flow, deps, state } = await resumed(); const ack = state().acknowledgement
    deps.save.mockRejectedValueOnce(error(409, 'DRAFT_LIMIT_REACHED')); await flow.save(); expect(state().message).toBe('draftLimit')
    deps.submit.mockRejectedValueOnce(error(400, 'PLACE_NOT_YET_OPEN')); await flow.submit(); expect(state().message).toBe('notYetOpen')
    expect(state()).toMatchObject({ media, acknowledgement: ack, fields: { visitTips: 'server' } })
  })
  it('resolution-token retry is bounded, same-place and uses frozen enrichment', async () => {
    const { flow, deps } = await resumed(); flow.dispatch({ type: 'PATCH', value: { resolvedLink: 'https://maps.google.com/maps/a', resolutionToken: 'old' } })
    deps.submit.mockRejectedValueOnce(error(400, 'RESOLUTION_TOKEN_INVALID')); await flow.submit()
    expect(deps.resolve).toHaveBeenCalledTimes(1); expect(deps.submit).toHaveBeenCalledTimes(2)
    expect(deps.submit.mock.calls[1][0]).toEqual({ ...deps.submit.mock.calls[0][0], resolutionToken: 'fresh-proof' })
  })
  it.each([new NetworkError(), error(503, 'UNAVAILABLE'), error(400, 'INVALID_LINK')])('F-11 failed re-resolution after explicit token rejection stays editable (%s)', async failure => {
    const { flow, deps, state } = await resumed()
    flow.dispatch({ type: 'PATCH', value: { resolvedLink: 'https://maps.google.com/maps/a', resolutionToken: 'old' } })
    const before = state()
    deps.submit.mockRejectedValueOnce(error(400, 'RESOLUTION_TOKEN_INVALID')); deps.resolve.mockRejectedValueOnce(failure)
    await flow.submit()
    expect(state()).toMatchObject({ phase: 'editing', message: 'temporarilyUnavailable', captured: null, fields: before.fields, draft: before.draft, media: before.media, acknowledgement: before.acknowledgement })
    expect(deps.submit).toHaveBeenCalledTimes(1); expect(deps.remove).not.toHaveBeenCalled()
    await flow.save(); await flow.refreshList(); expect(deps.save).toHaveBeenCalledTimes(1)
    await flow.submit(); expect(deps.submit).toHaveBeenCalledTimes(2)
  })
  it.each(['lost', 'rejected', 'accepted'] as const)('expired-token bounded POST retry %s is classified by the actual POST outcome', async outcome => {
    const { flow, deps, state } = await resumed()
    flow.dispatch({ type: 'PATCH', value: { resolvedLink: 'https://maps.google.com/maps/a', resolutionToken: 'old' } })
    deps.submit.mockRejectedValueOnce(error(400, 'RESOLUTION_TOKEN_INVALID'))
    if (outcome === 'lost') deps.submit.mockRejectedValueOnce(new TimeoutError(1))
    else if (outcome === 'rejected') deps.submit.mockRejectedValueOnce(error(400, 'RESOLUTION_TOKEN_INVALID'))
    await flow.submit(); expect(deps.resolve).toHaveBeenCalledTimes(1); expect(deps.submit).toHaveBeenCalledTimes(2)
    if (outcome === 'lost') {
      expect(state()).toMatchObject({ phase: 'submissionUnknown', captured: deps.submit.mock.calls[1][0] })
      await flow.submit(); await flow.save(); await flow.deleteDraft(); flow.startNew()
      expect(deps.submit).toHaveBeenCalledTimes(2); expect(deps.remove).not.toHaveBeenCalled(); expect(deps.save).not.toHaveBeenCalled()
    } else if (outcome === 'rejected') expect(state()).toMatchObject({ phase: 'editing', captured: null, media, draft: { id: draft.id } })
    else { expect(state().phase).toBe('completed'); expect(deps.remove).toHaveBeenCalledWith({ id: draft.id, version: 3 }) }
  })
  it.each(['differentPlace', 'noToken', 'unresolved', 'offline'] as const)('token re-resolution %s never issues a second POST and preserves ownership', async outcome => {
    const { flow, deps, state } = await resumed()
    flow.dispatch({ type: 'PATCH', value: { resolvedLink: 'https://maps.google.com/maps/a', resolutionToken: 'old' } })
    deps.submit.mockRejectedValueOnce(error(400, 'RESOLUTION_TOKEN_INVALID'))
    deps.resolve.mockImplementationOnce(async () => {
      if (outcome === 'offline') flow.online = false
      return outcome === 'unresolved' ? { status: 'UNRESOLVED' } : { status: 'RESOLVED', resolutionToken: outcome === 'noToken' ? undefined : 'fresh', candidate: { googlePlaceId: outcome === 'differentPlace' ? 'place-b' : 'place-a' } }
    })
    await flow.submit(); expect(deps.submit).toHaveBeenCalledTimes(1); expect(deps.remove).not.toHaveBeenCalled()
    expect(state()).toMatchObject({ phase: 'editing', captured: null, draft: { id: draft.id }, media })
  })
  it('start-new choice survives list refresh and resets on explicit resume or a different flow', async () => {
    const { flow, deps, state } = await resumed()
    deps.save.mockRejectedValueOnce(error(409, 'DRAFT_MODIFIED')); await flow.save(); flow.startNew(); await flow.refreshList()
    expect(state()).toMatchObject({ newDraftChosen: true, draft: null }); expect(state().list.map(d => d.id)).toContain(draft.id)
    await flow.requestResume(draft.id); expect(state().newDraftChosen).toBe(false)
    flow.startNew(); flow.selectPlace('place-b'); expect(state().newDraftChosen).toBe(false)
  })
  it.each(['read', 'save', 'submit', 'resolve', 'cleanup', 'list'] as const)('late %s work cannot affect reset generation or unmounted flow (not T13)', async stage => {
    const { flow, deps, state } = await resumed(); const slow = deferred<never>()
    let work: Promise<unknown>
    if (stage === 'read') { deps.read.mockReturnValueOnce(slow.promise); work = flow.resume(draft.id) }
    else if (stage === 'save') { deps.save.mockReturnValueOnce(slow.promise); work = flow.save() }
    else if (stage === 'list') { deps.list.mockReturnValueOnce(slow.promise); work = flow.refreshList() }
    else {
      if (stage === 'submit') deps.submit.mockReturnValueOnce(slow.promise)
      if (stage === 'resolve') { flow.dispatch({ type: 'PATCH', value: { resolvedLink: 'https://maps.google.com/maps/a' } }); deps.submit.mockRejectedValueOnce(error(400, 'RESOLUTION_TOKEN_INVALID')); deps.resolve.mockReturnValueOnce(slow.promise) }
      if (stage === 'cleanup') deps.remove.mockReturnValueOnce(slow.promise)
      work = flow.submit(); await Promise.resolve(); await Promise.resolve()
    }
    flow.reset(); flow.selectPlace('place-b'); const reset = state(); slow.reject(new NetworkError()); await work
    expect(state()).toBe(reset); expect(state().captured).toBeNull()
  })
  it('M15 offline permits local photo removal and disables all server actions', async () => {
    const { flow, deps, state } = await resumed(); flow.online = false; flow.edit({ visitTips: 'keep' }); flow.setMedia([])
    await flow.save(); await flow.submit(); await flow.deleteDraft(); await flow.refreshList()
    expect(state().media).toEqual([]); expect(state().fields.visitTips).toBe('keep'); expect(deps.save).not.toHaveBeenCalled(); expect(deps.remove).not.toHaveBeenCalled(); expect(deps.list).not.toHaveBeenCalled()
  })
  it('M15 stale list sequence/revision cannot resurrect a deleted draft or overwrite later save', async () => {
    const { flow, deps, state } = await resumed(); const slow = deferred<{ items: ContributionDraft[] }>(); deps.list.mockReturnValueOnce(slow.promise)
    const listing = flow.refreshList(); await flow.deleteDraft(); slow.resolve({ items: [draft] }); await listing
    expect(state().list).toEqual([]); expect(state().tombstones).toContain(draft.id)
    const older = deferred<{ items: ContributionDraft[] }>(); deps.list.mockReturnValueOnce(older.promise)
    const first = flow.refreshList(); deps.list.mockResolvedValueOnce({ items: [{ ...draft, id: 'latest' }] }); await flow.refreshList(); older.resolve({ items: [draft] }); await first
    expect(state().list.map(d => d.id)).toEqual(['latest'])
  })
  it('M15 list-route 404 proves nothing about active ownership; recovery remains available', async () => {
    const { flow, deps, state } = await resumed(); flow.edit({ visitTips: 'keep' }); deps.list.mockRejectedValueOnce(error(404, 'NOT_FOUND')); await flow.refreshList()
    expect(state()).toMatchObject({ listError: true, draft: { id: draft.id }, media, fields: { visitTips: 'keep' } }); expect(acknowledgementValid(state())).toBe(true)
  })
})

it('delete retry retains an unrelated target instead of deleting the active draft', async () => {
  const { flow, deps, state } = await resumed()
  deps.remove.mockRejectedValueOnce(new NetworkError()); await flow.deleteDraft({ id: 'other', version: 5 })
  expect(state().deleteFailure).toEqual({ id: 'other', version: 5 })
  await flow.deleteDraft(state().deleteFailure!)
  expect(deps.remove.mock.calls).toEqual([[{ id: 'other', version: 5 }], [{ id: 'other', version: 5 }]])
  expect(state().draft?.id).toBe(draft.id); expect(state().media).toEqual(media)
})
it('stale listed expiry cannot detach a newer active draft', async () => {
  const { flow, deps, state } = await resumed()
  deps.list.mockResolvedValueOnce({ items: [{ ...draft, version: 1, expiresAt: '2020-01-01T00:00:00Z' }] })
  await flow.refreshList(); expect(state().draft?.version).toBe(3); expect(state().media).toEqual(media)
})
it('a dispatched create in conflict cannot be discarded as never dispatched', async () => {
  const { flow, deps, state } = setup()
  deps.save.mockRejectedValueOnce(error(409, 'DRAFT_MODIFIED')); await flow.save()
  deps.read.mockResolvedValueOnce({ ...draft, id: 'new-uuid' }); await flow.deleteDraft()
  expect(deps.read).toHaveBeenCalledWith('new-uuid'); expect(deps.remove).not.toHaveBeenCalled(); expect(state().draft?.id).toBe('new-uuid')
})
it('unmount guards every asynchronous completion without claiming session-epoch cancellation', async () => {
  const { flow, deps, state } = await resumed(); const slow = deferred<ContributionDraft>(); deps.save.mockReturnValueOnce(slow.promise)
  const saving = flow.save(); const before = state(); flow.dispose(); slow.resolve({ ...draft, version: 4 }); await saving
  expect(state()).toBe(before); expect(deps.report).not.toHaveBeenCalledWith('place_contribution_draft_saved')
})
it('M13 client retirement cannot atomically remove the remote draft across a crash or device B', async () => {
  const { flow, deps, state } = await resumed()
  const cleanup = deferred<unknown>(); deps.remove.mockReturnValueOnce(cleanup.promise)
  const submitted = flow.submit(); await Promise.resolve(); await Promise.resolve()
  expect(state().tombstones).toContain(draft.id) // Only this client knows it is retired.
  const deviceB = new ImportFlowController(deps); deviceB.registered = true; deviceB.selectPlace('place-a')
  await deviceB.refreshList(); expect(deviceB.getSnapshot().list.map(d => d.id)).toContain(draft.id)
  flow.dispose(); cleanup.reject(new NetworkError()); await submitted
  expect(deviceB.getSnapshot().list.map(d => d.id)).toContain(draft.id)
  // This intentionally exposes the BE atomic-consumption gap; it is not a client closure of global F-07.
})
