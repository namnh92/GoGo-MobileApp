import type { AnalyticsEvent } from '@/shared/analytics'
import { isApiError } from '@/shared/api/errors'
import { getSessionGeneration, subscribeToSession } from '@/shared/api/session'
import type { OpBody, OpResponse, ResolveLinkResult } from '@/shared/api'
import { draftEnrichment, emptyContribution, priceValid, resumeContribution, submissionEnrichment, type ContributionDraft, type ContributionForm, type EnrichmentDraft } from './contribution-form'

type Phase = 'editing' | 'reading' | 'saving' | 'conflict' | 'mediaRecovery' | 'deleting' | 'submitting' | 'submissionUnknown' | 'retiring' | 'completed'
type Identity = Pick<ContributionDraft, 'id' | 'version' | 'expiresAt'>
type Media = NonNullable<EnrichmentDraft['photos']>
type Ack = { bills: string; sessionEpoch: number; flowGeneration: number }
type SaveBody = OpBody<'savePlaceContributionDraft'>
type Result = OpResponse<'submitPlace'>
export type FlowMessage = 'newDraft' | 'resumed' | 'draftUnavailable' | 'saved' | 'draftChanged' | 'photosUnavailable' | 'deleted' | 'deleteFailed' | 'submitted' | 'submittedCleanupPending' | 'alreadyExists' | 'submissionUnconfirmed' | 'draftLimit' | 'temporarilyUnavailable' | 'billAcknowledgementRequired' | 'saveUnconfirmed' | 'notYetOpen'
export interface ImportFlowState {
  sessionEpoch: number
  flowGeneration: number
  operationId: number
  targetDraftId: string | null
  phase: Phase
  link: string
  resolvedLink: string | null
  resolution: ResolveLinkResult | null
  candidate: ResolveLinkResult['candidate'] | null
  googlePlaceId: string | null
  resolutionToken: string | null
  fields: ContributionForm
  draft: Identity | null
  pendingCreate: { id: string; request: SaveBody; uncertain: boolean; inputRevision: number } | null
  captured: SaveBody | OpBody<'submitPlace'> | null
  media: Media
  acknowledgement: Ack | null
  deleteFailure: { id: string; version: number } | null
  conflict: { id: string; version?: number } | null
  list: ContributionDraft[]
  listSequence: number
  mutationRevision: number
  listLoading: boolean
  listError: boolean
  tombstones: string[]
  result: Result | null
  resultVisible: boolean
  cleanup: { id: string; version: number; changedVersion?: number; review?: { fields: ContributionForm; mediaCount: number } } | null
  message: FlowMessage
  dirty: boolean
  inputRevision: number
  step: number
  replacement: string | null
  newDraftChosen: boolean
}
export interface FlowDependencies {
  uuid: () => string
  now: () => number
  list: () => Promise<OpResponse<'listPlaceContributionDrafts'>>
  read: (id: string) => Promise<ContributionDraft>
  save: (args: { id: string; body: SaveBody }) => Promise<ContributionDraft>
  remove: (args: { id: string; version: number }) => Promise<unknown>
  submit: (body: OpBody<'submitPlace'>) => Promise<Result>
  resolve: (body: OpBody<'resolveGoogleMapsLink'>) => Promise<ResolveLinkResult>
  report: (event: AnalyticsEvent, data?: Record<string, string | number>) => void
}
export const initialImportFlow = (generation = 0, sessionEpoch = 0): ImportFlowState => ({
  sessionEpoch, flowGeneration: generation, operationId: 0, targetDraftId: null,
  phase: 'editing', link: '', resolvedLink: null, resolution: null, candidate: null,
  googlePlaceId: null, resolutionToken: null, fields: emptyContribution(), draft: null,
  pendingCreate: null, captured: null, media: [], acknowledgement: null, conflict: null, deleteFailure: null,
  list: [], listSequence: 0, mutationRevision: 0, listLoading: false, listError: false,
  tombstones: [], result: null, resultVisible: false, cleanup: null, message: 'newDraft', dirty: false, inputRevision: 0,
  step: 1, replacement: null, newDraftChosen: false,
})
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const bills = (media: Media) => media.filter(p => p.kind === 'bill').map(p => p.mediaId).sort().join('|')
const ackFor = (s: ImportFlowState, media: Media): Ack | null => bills(media)
  ? { bills: bills(media), sessionEpoch: s.sessionEpoch, flowGeneration: s.flowGeneration } : null
export const acknowledgementValid = (s: ImportFlowState) => !bills(s.media) || !!s.acknowledgement &&
  s.acknowledgement.bills === bills(s.media) && s.acknowledgement.sessionEpoch === s.sessionEpoch && s.acknowledgement.flowGeneration === s.flowGeneration
export const foregroundBusy = (s: ImportFlowState) => ['reading', 'saving', 'deleting', 'submitting'].includes(s.phase)
export const writesAllowed = (s: ImportFlowState) => s.phase === 'editing' && acknowledgementValid(s)
export function serializeFlow(s: ImportFlowState): EnrichmentDraft {
  const media = ['editing', 'saving', 'submitting'].includes(s.phase) ? s.media : []
  return clone({ ...draftEnrichment(s.fields), ...(media.length ? { photos: media } : {}),
    ...(bills(media) && acknowledgementValid(s) ? { billPhotoPublicConsent: true } : {}) })
}
const activeId = (s: ImportFlowState) => s.draft?.id ?? s.pendingCreate?.id
const tombstone = (s: ImportFlowState, id: string) => ({
  listLoading: false, tombstones: [...new Set([...s.tombstones, id])], list: s.list.filter(d => d.id !== id), mutationRevision: s.mutationRevision + 1,
})
/** The only detach path: never let form adapters retain draft-owned media. */
function detach(s: ImportFlowState, message: FlowMessage): ImportFlowState {
  return { ...s, draft: null, pendingCreate: null, conflict: null, media: [], acknowledgement: null,
    captured: null, deleteFailure: null, phase: 'editing', message, replacement: null, newDraftChosen: true }
}
function install(s: ImportFlowState, draft: ContributionDraft, message: FlowMessage): ImportFlowState {
  const fields = resumeContribution(clone(draft.enrichment))
  const media = clone(draft.enrichment.photos ?? [])
  return { ...s, fields, media, acknowledgement: draft.enrichment.billPhotoPublicConsent === true ? ackFor(s, media) : null,
    draft: { id: draft.id, version: draft.version, expiresAt: draft.expiresAt }, pendingCreate: null,
    captured: null, conflict: null, phase: 'editing', message, dirty: false, replacement: null, listLoading: false, deleteFailure: null,
    mutationRevision: s.mutationRevision + 1, newDraftChosen: false,
    list: [...s.list.filter(d => d.id !== draft.id), clone(draft)] }
}
type Action =
  | { type: 'PATCH'; value: Partial<ImportFlowState> }
  | { type: 'RESET_FLOW'; link?: string; sessionEpoch?: number }
  | { type: 'DETACH_ACTIVE'; reason: FlowMessage }
  | { type: 'EDIT'; value: Partial<ContributionForm> }
  | { type: 'MEDIA'; media: Media }
  | { type: 'ACKNOWLEDGE' }
  | { type: 'INSTALL'; draft: ContributionDraft; message: 'saved' | 'resumed' }
  | { type: 'RECONCILED_SAVE'; draft: ContributionDraft; dirty: boolean }
  | { type: 'ABSENT'; id: string; reason: 'deleted' | 'draftUnavailable' }
  | { type: 'ACCEPTED'; result: Result }
export function importFlowReducer(s: ImportFlowState, action: Action): ImportFlowState {
  switch (action.type) {
    case 'PATCH': return { ...s, ...action.value }
    case 'RESET_FLOW': return { ...initialImportFlow(s.flowGeneration + 1, action.sessionEpoch ?? s.sessionEpoch), link: action.link ?? '' }
    case 'DETACH_ACTIVE': return detach(s, action.reason)
    case 'EDIT': {
      if (foregroundBusy(s) || ['submissionUnknown', 'retiring', 'completed'].includes(s.phase)) return s
      return { ...s, fields: { ...s.fields, ...clone(action.value) }, dirty: true, inputRevision: s.inputRevision + 1 }
    }
    case 'MEDIA': return { ...s, media: clone(action.media), acknowledgement: bills(s.media) === bills(action.media) ? s.acknowledgement : null, dirty: true, inputRevision: s.inputRevision + 1 }
    case 'ACKNOWLEDGE': return { ...s, acknowledgement: ackFor(s, s.media), message: 'resumed', dirty: true, inputRevision: s.inputRevision + 1 }
    case 'INSTALL': return install(s, action.draft, action.message)
    case 'RECONCILED_SAVE': return { ...install(s, action.draft, 'saved'), fields: s.fields, media: s.media,
      acknowledgement: s.acknowledgement, dirty: action.dirty }
    case 'ABSENT': {
      const next = { ...s, ...tombstone(s, action.id) }
      return activeId(s) === action.id ? detach(next, action.reason) : next
    }
    case 'ACCEPTED': {
      const next = s.draft ? { ...s, ...tombstone(s, s.draft.id) } : s
      return { ...detach(next, 'submitted'), result: clone(action.result),
        cleanup: s.draft ? { id: s.draft.id, version: s.draft.version } : null,
        phase: s.draft ? 'retiring' : 'completed', dirty: false, resultVisible: true }
    }
  }
}
interface Ticket { sessionEpoch: number; flowGeneration: number; operationId: number; targetDraftId: string | null }
/** Reducer + guarded effects; scoped to the mounted import flow, never persisted. */
export class ImportFlowController {
  private state = initialImportFlow(0, getSessionGeneration())
  private listeners = new Set<() => void>()
  private alive = true
  private cleanupRunning = false
  private unsubscribeSession: (() => void) | null = null
  online = true
  registered = false
  constructor(public dependencies: FlowDependencies) {}
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  dispatch = (action: Action) => {
    if (!this.alive) return
    this.state = importFlowReducer(this.state, action)
    this.listeners.forEach(listener => listener())
  }
  configure(online: boolean, registered: boolean) { this.online = online; this.registered = registered }
  private syncSession = () => {
    const sessionEpoch = getSessionGeneration()
    if (sessionEpoch === this.state.sessionEpoch) return
    this.cleanupRunning = false
    this.dispatch({ type: 'RESET_FLOW', sessionEpoch })
  }
  mount = () => {
    this.alive = true
    this.unsubscribeSession ??= subscribeToSession(this.syncSession)
    this.syncSession()
  }
  dispose = () => {
    this.alive = false
    this.unsubscribeSession?.()
    this.unsubscribeSession = null
  }
  private patch(value: Partial<ImportFlowState>) { this.dispatch({ type: 'PATCH', value }) }
  capture(targetDraftId: string | null = this.state.targetDraftId): Ticket {
    const { sessionEpoch, flowGeneration, operationId } = this.state
    return { sessionEpoch, flowGeneration, operationId, targetDraftId }
  }
  current = (ticket: Ticket) => this.alive && ticket.sessionEpoch === getSessionGeneration() && ticket.sessionEpoch === this.state.sessionEpoch &&
    ticket.flowGeneration === this.state.flowGeneration && ticket.operationId === this.state.operationId && ticket.targetDraftId === this.state.targetDraftId
  private begin(phase: Phase, targetDraftId: string | null = null): Ticket | null {
    if (!this.online || foregroundBusy(this.state)) return null
    this.patch({ phase, operationId: this.state.operationId + 1, targetDraftId, replacement: null })
    return this.capture(targetDraftId)
  }
  reset(link = '') { this.cleanupRunning = false; this.dispatch({ type: 'RESET_FLOW', link }) }
  selectPlace(id: string, candidate?: ResolveLinkResult['candidate']) {
    if (id === this.state.googlePlaceId) return
    const { link, resolvedLink, resolution, resolutionToken } = this.state
    this.reset(link)
    this.patch({ googlePlaceId: id, candidate: candidate ?? null, resolvedLink, resolution, resolutionToken })
  }
  startResolution(link: string) {
    if (!this.online || foregroundBusy(this.state)) return null
    this.reset(link)
    this.patch({ resolvedLink: link })
    return this.begin('reading')
  }
  resolutionFailed(ticket: Ticket) {
    if (this.current(ticket)) this.patch({ phase: 'editing' })
  }
  resolved(result: ResolveLinkResult, link: string) {
    this.patch({ resolution: clone(result), resolvedLink: link, resolutionToken: result.resolutionToken ?? null,
      candidate: result.candidate ?? null, googlePlaceId: result.status === 'RESOLVED' ? result.candidate?.googlePlaceId ?? null : null, phase: 'editing' })
  }
  edit(value: Partial<ContributionForm>) { this.dispatch({ type: 'EDIT', value }) }
  setMedia(media: Media) { if (!foregroundBusy(this.state) && !['retiring', 'completed', 'submissionUnknown'].includes(this.state.phase)) this.dispatch({ type: 'MEDIA', media }) }
  acknowledge() { if (!foregroundBusy(this.state) && this.state.phase === 'editing') this.dispatch({ type: 'ACKNOWLEDGE' }) }
  continueWithoutPhotos() {
    if (foregroundBusy(this.state) || !['editing', 'mediaRecovery'].includes(this.state.phase)) return
    this.dispatch({ type: 'MEDIA', media: [] }); this.patch({ phase: 'editing', captured: null, message: 'resumed' })
  }
  startNew() {
    if (foregroundBusy(this.state) || ['retiring', 'completed', 'submissionUnknown'].includes(this.state.phase) || this.state.pendingCreate?.uncertain) return
    this.dispatch({ type: 'DETACH_ACTIVE', reason: 'newDraft' })
  }
  move(step: number) { if (!foregroundBusy(this.state)) this.patch({ step }) }
  requestResume(id: string) {
    if (!this.registered || !this.online || foregroundBusy(this.state) || ['retiring', 'completed', 'submissionUnknown'].includes(this.state.phase)) return Promise.resolve()
    if (this.state.dirty) { this.patch({ replacement: id }); return Promise.resolve() }
    return this.resume(id)
  }
  cancelReplacement() { this.patch({ replacement: null }) }
  confirmReplacement() { const id = this.state.replacement; return id ? this.resume(id) : Promise.resolve() }
  private expired(draft: Identity) { return Date.parse(draft.expiresAt) <= this.dependencies.now() }
  expireActive() {
    if (!this.state.draft || !this.expired(this.state.draft) || ['submitting', 'retiring', 'completed', 'submissionUnknown'].includes(this.state.phase)) return false
    this.patch({ operationId: this.state.operationId + 1 })
    this.dispatch({ type: 'ABSENT', id: this.state.draft.id, reason: 'draftUnavailable' })
    void this.refreshList()
    return true
  }
  private validDraft(draft: ContributionDraft, id: string) { return draft.id === id && draft.googlePlaceId === this.state.googlePlaceId && !this.state.tombstones.includes(id) }
  async resume(id: string) {
    if (!this.registered || ['retiring', 'completed', 'submissionUnknown'].includes(this.state.phase)) return
    const previousPhase = this.state.phase
    const ticket = this.begin('reading', id)
    if (!ticket) return
    try {
      const draft = await this.dependencies.read(id)
      if (!this.current(ticket)) return
      if (!this.validDraft(draft, id)) { this.patch({ phase: previousPhase, message: 'temporarilyUnavailable' }); return }
      if (this.expired(draft)) {
        const wasActive = activeId(this.state) === id
        this.dispatch({ type: 'ABSENT', id, reason: 'draftUnavailable' })
        this.patch({ phase: wasActive ? 'editing' : previousPhase, message: 'draftUnavailable' })
        void this.refreshList(); return
      }
      this.dispatch({ type: 'INSTALL', draft, message: 'resumed' })
      this.patch({ step: 1 })
      this.dependencies.report('place_contribution_draft_resumed')
    } catch (error) {
      if (!this.current(ticket)) return
      if (isApiError(error) && error.status === 404) {
        const wasActive = activeId(this.state) === id
        this.dispatch({ type: 'ABSENT', id, reason: 'draftUnavailable' })
        this.patch({ phase: wasActive ? 'editing' : previousPhase })
        void this.refreshList()
      } else {
        this.patch({ phase: previousPhase, message: 'temporarilyUnavailable' })
        this.reportRead(error, 'resume')
      }
    }
  }
  private reportRead(error: unknown, operation: 'list' | 'resume') {
    this.dependencies.report('place_contribution_draft_read_failed', { operation, status: isApiError(error) ? error.status : 0 })
  }
  private conflict(id: string, version?: number) {
    this.patch({ phase: 'conflict', conflict: { id, version }, captured: null, message: 'draftChanged' })
  }
  private writeError(error: unknown): boolean {
    if (!isApiError(error)) return false
    if (error.fieldErrors.some(e => /(?:^|\.)billPhotoPublicConsent$/.test(e.field))) {
      this.patch({ phase: 'editing', acknowledgement: null, captured: null, message: 'billAcknowledgementRequired' }); return true
    }
    if (['INVALID_SUBMISSION_PHOTOS', 'INVALID_UPLOAD_KEY'].includes(error.code) || error.fieldErrors.some(e => /^(?:enrichment\.)?photos(?:\.|\[|$)/.test(e.field))) {
      // Contract does not reliably identify rejected media IDs: remove the entire set.
      this.patch({ phase: 'mediaRecovery', media: [], acknowledgement: null, captured: null, message: 'photosUnavailable' }); return true
    }
    if (error.code === 'DRAFT_MODIFIED') { this.conflict(activeId(this.state)!); return true }
    this.patch({ phase: 'editing', captured: null, message: error.code === 'DRAFT_LIMIT_REACHED' ? 'draftLimit' : error.code === 'PLACE_NOT_YET_OPEN' ? 'notYetOpen' : 'temporarilyUnavailable' })
    return true
  }
  async save() {
    if (!this.registered || !this.online || !writesAllowed(this.state) || !priceValid(this.state.fields) || !this.state.googlePlaceId || this.expireActive()) return
    if (this.state.pendingCreate?.uncertain) { await this.reconcileSave(); return }
    const id = activeId(this.state) ?? this.dependencies.uuid()
    const inputRevision = this.state.inputRevision
    const body: SaveBody = { googlePlaceId: this.state.googlePlaceId, expectedVersion: this.state.draft?.version ?? 0, enrichment: serializeFlow(this.state) }
    const ticket = this.begin('saving', id)
    if (!ticket) return
    this.patch({ captured: body, ...(!this.state.draft ? { pendingCreate: { id, request: body, uncertain: false, inputRevision } } : {}) })
    try {
      const saved = await this.dependencies.save({ id, body: clone(body) })
      if (!this.current(ticket)) return
      if (!this.validDraft(saved, id)) { this.conflict(id); return }
      if (this.expired(saved)) { this.dispatch({ type: 'ABSENT', id, reason: 'draftUnavailable' }); return }
      this.dispatch({ type: 'INSTALL', draft: saved, message: 'saved' })
      this.dependencies.report('place_contribution_draft_saved')
      void this.refreshList()
    } catch (error) {
      if (!this.current(ticket)) return
      if (isApiError(error) && error.status >= 400 && error.status < 500 && ![408, 425].includes(error.status)) {
        this.patch({ pendingCreate: null })
        // A 409 for a create still needs an identity for explicit reload.
        if (error.code === 'DRAFT_MODIFIED') this.patch({ pendingCreate: { id, request: body, uncertain: false, inputRevision } })
        this.writeError(error)
      } else {
        // Keep UUID AND immutable request even for an update with an uncertain version.
        this.patch({ phase: 'editing', pendingCreate: { id, request: body, uncertain: true, inputRevision }, message: 'saveUnconfirmed' })
      }
    }
  }
  async reconcileSave() {
    const pending = this.state.pendingCreate
    if (!pending?.uncertain) return
    const ticket = this.begin('reading', pending.id)
    if (!ticket) return
    try {
      const draft = await this.dependencies.read(pending.id)
      if (!this.current(ticket)) return
      if (!this.validDraft(draft, pending.id)) { this.patch({ phase: 'editing', message: 'saveUnconfirmed' }); return }
      if (this.expired(draft)) { this.dispatch({ type: 'ABSENT', id: pending.id, reason: 'draftUnavailable' }); return }
      // Exact returned enrichment is proof of this frozen write. Anything else needs review.
      if (stable(draft.enrichment) === stable(pending.request.enrichment)) {
        // Confirm identity/version without replacing anything edited after the uncertain PUT.
        this.dispatch({ type: 'RECONCILED_SAVE', draft, dirty: this.state.inputRevision !== pending.inputRevision })
      } else {
        // A matching GET resolves uncertainty, even when the remote data needs conflict review.
        this.patch({ pendingCreate: null, draft: this.state.draft ?? { id: draft.id, version: draft.version, expiresAt: draft.expiresAt } })
        this.conflict(pending.id, draft.version)
      }
    } catch (error) {
      if (!this.current(ticket)) return
      if (isApiError(error) && error.status === 404) {
        this.dispatch({ type: 'ABSENT', id: pending.id, reason: 'draftUnavailable' }); void this.refreshList()
      } else this.patch({ phase: 'editing', message: 'saveUnconfirmed' })
    }
  }
  async deleteDraft(target?: { id: string; version: number }) {
    if (!this.online || !this.registered || foregroundBusy(this.state) || ['submissionUnknown', 'retiring', 'completed'].includes(this.state.phase)) return
    if (this.state.pendingCreate && (!target || target.id === this.state.pendingCreate.id)) {
      if (this.state.pendingCreate.uncertain) await this.reconcileSave()
      else await this.resume(this.state.pendingCreate.id)
      return
    }
    const draft = target ?? this.state.draft
    if (!draft) { this.dispatch({ type: 'DETACH_ACTIVE', reason: 'deleted' }); return }
    const previousPhase = this.state.phase
    const ticket = this.begin('deleting', draft.id)
    if (!ticket) return
    try {
      await this.dependencies.remove({ id: draft.id, version: draft.version })
      if (!this.current(ticket)) return
      this.dispatch({ type: 'ABSENT', id: draft.id, reason: 'deleted' })
      this.patch({ phase: this.state.conflict ? 'conflict' : 'editing', message: 'deleted', deleteFailure: null })
      this.dependencies.report('place_contribution_draft_deleted')
      void this.refreshList()
    } catch (error) {
      if (!this.current(ticket)) return
      this.patch({ deleteFailure: { id: draft.id, version: draft.version } })
      if (isApiError(error) && (error.status === 404 || error.code === 'DRAFT_MODIFIED')) await this.reconcileDelete(ticket, draft.id, false)
      else {
        this.patch({ phase: previousPhase, message: 'deleteFailed' })
        this.dependencies.report('place_contribution_draft_delete_failed', { status: isApiError(error) ? error.status : 0 })
      }
    }
  }
  private async reconcileDelete(ticket: Ticket, id: string, retiring: boolean) {
    if (!this.current(ticket)) return
    if (!retiring) this.patch({ phase: 'reading' })
    try {
      const draft = await this.dependencies.read(id)
      if (!this.current(ticket)) return
      if (!this.validDraft(draft, id) && !retiring) { this.patch({ phase: 'editing', message: 'deleteFailed' }); return }
      if (!retiring && this.expired(draft)) {
        this.dispatch({ type: 'ABSENT', id, reason: 'draftUnavailable' })
        this.patch({ phase: this.state.conflict ? 'conflict' : 'editing' }); void this.refreshList(); return
      }
      if (retiring) {
        if (draft.id !== id || draft.googlePlaceId !== this.state.googlePlaceId) { this.patch({ phase: 'retiring', message: 'submittedCleanupPending' }); return }
        this.patch({ phase: 'retiring', cleanup: { ...this.state.cleanup!, changedVersion: draft.version, review: { fields: resumeContribution(draft.enrichment), mediaCount: draft.enrichment.photos?.length ?? 0 } }, message: 'submittedCleanupPending' })
      }
      else this.conflict(id, draft.version)
    } catch (error) {
      if (!this.current(ticket)) return
      if (isApiError(error) && error.status === 404) {
        if (retiring) this.patch({ cleanup: null, phase: 'completed', message: 'submitted' })
        else { this.dispatch({ type: 'ABSENT', id, reason: 'draftUnavailable' }); this.patch({ phase: this.state.conflict ? 'conflict' : 'editing' }); void this.refreshList() }
      } else this.patch({ phase: retiring ? 'retiring' : this.state.conflict ? 'conflict' : 'editing', message: retiring ? 'submittedCleanupPending' : 'deleteFailed' })
    }
  }
  async refreshList() {
    if (!this.registered || !this.online) return
    const { sessionEpoch, flowGeneration, mutationRevision } = this.state
    const sequence = this.state.listSequence + 1
    this.patch({ listSequence: sequence, listLoading: true })
    const current = () => this.alive && sessionEpoch === getSessionGeneration() && sessionEpoch === this.state.sessionEpoch && flowGeneration === this.state.flowGeneration &&
      mutationRevision === this.state.mutationRevision && sequence === this.state.listSequence
    try {
      const result = await this.dependencies.list()
      if (!current()) return
      this.patch({ list: clone(result.items).filter(d => !this.state.tombstones.includes(d.id)), listError: false, listLoading: false })
      if (this.expireActive() || foregroundBusy(this.state) || this.state.phase !== 'editing') return
      if (this.state.pendingCreate?.uncertain) { await this.reconcileSave(); return }
      if (!this.state.draft) return
      const draft = this.state.draft
      const listed = this.state.list.find(d => d.id === draft.id)
      if (listed && listed.version > draft.version) this.conflict(draft.id, listed.version)
      else if (!listed || listed.version < draft.version) await this.probeActive(draft.id)
    } catch (error) {
      if (!current()) return
      this.patch({ listError: true, listLoading: false })
      this.reportRead(error, 'list')
    } finally {
      if (current()) this.patch({ listLoading: false })
    }
  }
  private async probeActive(id: string) {
    const ticket = this.begin('reading', id)
    if (!ticket) return
    try {
      const draft = await this.dependencies.read(id)
      if (!this.current(ticket)) return
      if (!this.validDraft(draft, id)) { this.patch({ phase: 'editing', message: 'temporarilyUnavailable' }); return }
      if (this.expired(draft)) this.dispatch({ type: 'ABSENT', id, reason: 'draftUnavailable' })
      else if (draft.version > (this.state.draft?.version ?? 0)) this.conflict(id, draft.version)
      else this.patch({ phase: 'editing' }) // Presence check must NEVER replace local edits.
    } catch (error) {
      if (!this.current(ticket)) return
      if (isApiError(error) && error.status === 404) { this.dispatch({ type: 'ABSENT', id, reason: 'draftUnavailable' }); void this.refreshList() }
      else this.patch({ phase: 'editing', message: 'temporarilyUnavailable' })
    }
  }
  async submit(roomId?: string) {
    if (!this.online || !writesAllowed(this.state) || this.state.pendingCreate?.uncertain || !this.state.googlePlaceId || this.expireActive()) return
    const enrichment = submissionEnrichment(this.state.fields)
    if (!enrichment) return
    const body: OpBody<'submitPlace'> = { googlePlaceId: this.state.googlePlaceId,
      ...(this.state.resolutionToken ? { resolutionToken: this.state.resolutionToken } : {}), ...(roomId ? { roomId } : {}),
      enrichment: serializeFlow(this.state) as NonNullable<OpBody<'submitPlace'>['enrichment']> }
    const ticket = this.begin('submitting', activeId(this.state) ?? null)
    if (!ticket) return
    this.patch({ captured: clone(body), resultVisible: false })
    try {
      let result: Result
      try { result = await this.dependencies.submit(clone(body)) }
      catch (error) {
        if (!this.current(ticket)) return
        if (!isApiError(error) || error.code !== 'RESOLUTION_TOKEN_INVALID' || !this.state.resolvedLink) throw error
        if (!this.online) { this.patch({ phase: 'editing', captured: null, message: 'temporarilyUnavailable', resultVisible: true }); return }
        let fresh: ResolveLinkResult
        try { fresh = await this.dependencies.resolve({ url: this.state.resolvedLink, ...(roomId ? { roomId } : {}) }) }
        catch {
          // The POST was explicitly rejected; a failed GET-like resolution cannot make it uncertain.
          if (this.current(ticket)) this.patch({ phase: 'editing', captured: null, message: 'temporarilyUnavailable', resultVisible: true })
          return
        }
        if (!this.current(ticket)) return
        if (fresh.status !== 'RESOLVED' || !fresh.resolutionToken || fresh.candidate?.googlePlaceId !== body.googlePlaceId) {
          this.patch({ ...(fresh.status === 'CANDIDATE_SELECTION' || fresh.status === 'UNRESOLVED' ? { resolution: clone(fresh) } : {}), phase: 'editing', captured: null, message: 'temporarilyUnavailable' }); return
        }
        if (!this.online) { this.patch({ phase: 'editing', captured: null, message: 'temporarilyUnavailable', resultVisible: true }); return }
        const retryBody = { ...clone(body), resolutionToken: fresh.resolutionToken }
        this.patch({ resolutionToken: fresh.resolutionToken, captured: clone(retryBody) })
        result = await this.dependencies.submit(retryBody)
      }
      if (!this.current(ticket)) return
      if (result.status === 'ALREADY_EXISTS' && !result.submissionId) {
        this.patch({ phase: 'editing', result: clone(result), captured: null, message: 'alreadyExists' }); return
      }
      if (!result.submissionId || result.status !== 'PENDING') {
        this.patch({ phase: 'submissionUnknown', message: 'submissionUnconfirmed', resultVisible: true }); return
      }
      this.dispatch({ type: 'ACCEPTED', result })
      this.dependencies.report('place_import_added', { placeId: result.placeId ?? body.googlePlaceId })
      // Ownership is relinquished before the first cleanup await. No media-delete API.
      if (this.state.cleanup) await this.cleanup(ticket)
    } catch (error) {
      if (!this.current(ticket)) return
      if (isApiError(error) && error.status >= 400 && error.status < 500 && ![408, 425].includes(error.status)) {
        this.writeError(error)
        this.patch({ resultVisible: ['temporarilyUnavailable', 'notYetOpen'].includes(this.state.message) })
      }
      else this.patch({ phase: 'submissionUnknown', message: 'submissionUnconfirmed', resultVisible: true })
    }
  }
  private async cleanup(ticket: Ticket) {
    const cleanup = this.state.cleanup
    if (!this.online && this.current(ticket)) { this.patch({ phase: 'retiring', message: 'submittedCleanupPending' }); return }
    if (!cleanup || !this.current(ticket) || cleanup.changedVersion !== undefined || this.cleanupRunning) return
    this.cleanupRunning = true
    try {
      await this.dependencies.remove({ id: cleanup.id, version: cleanup.version })
      if (!this.current(ticket)) return
      this.patch({ cleanup: null, phase: 'completed', message: 'submitted' })
    } catch (error) {
      if (!this.current(ticket)) return
      if (isApiError(error) && (error.status === 404 || error.code === 'DRAFT_MODIFIED')) await this.reconcileDelete(ticket, cleanup.id, true)
      else this.patch({ phase: 'retiring', message: 'submittedCleanupPending' })
    } finally {
      if (this.current(ticket)) this.cleanupRunning = false
    }
  }
  async retryCleanup() {
    if (this.cleanupRunning || !this.online || this.state.phase !== 'retiring' || !this.state.cleanup || this.state.cleanup.changedVersion !== undefined || foregroundBusy(this.state)) return
    const ticket = this.begin('deleting', this.state.cleanup.id)
    if (!ticket) return
    this.patch({ phase: 'retiring' })
    await this.cleanup(ticket)
  }
  reviewChangedCleanup() { if (this.state.cleanup?.changedVersion !== undefined) this.patch({ replacement: this.state.cleanup.id }) }
  async deleteReviewedCleanup() {
    const cleanup = this.state.cleanup
    if (!cleanup || cleanup.changedVersion === undefined || this.state.replacement !== cleanup.id || !this.online) return
    this.patch({ cleanup: { id: cleanup.id, version: cleanup.changedVersion }, replacement: null })
    await this.retryCleanup()
  }
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${stable(v)}`).join(',')}}`
  return JSON.stringify(value)
}
