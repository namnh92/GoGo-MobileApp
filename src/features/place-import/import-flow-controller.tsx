import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { listContributionDrafts, getContributionDraft, saveContributionDraft, deleteContributionDraft, submitPlace, resolveGoogleMapsLink, newIdempotencyKey, type ResolveLinkResult } from '@/shared/api'
import { track } from '@/shared/analytics'
import { captureSessionScope, getSessionGeneration } from '@/shared/api/session'
import { ImportFlowController } from './import-flow'

const Context = createContext<ImportFlowController | null>(null)
export function createImportFlowController() {
  return new ImportFlowController({
    uuid: newIdempotencyKey, now: Date.now, list: listContributionDrafts, read: getContributionDraft,
    save: ({ id, body }) => saveContributionDraft(id, body), remove: ({ id, version }) => deleteContributionDraft(id, version),
    submit: submitPlace, resolve: resolveGoogleMapsLink, report: track,
  })
}
export function ImportFlowProvider({ children, online, registered, initialPlaceId, initialLink, initialResolution }: {
  children: ReactNode; online: boolean; registered: boolean; initialPlaceId?: string; initialLink?: string; initialResolution?: ResolveLinkResult
}) {
  const [controller] = useState(() => {
    const flow = createImportFlowController()
    if (initialLink !== undefined) {
      flow.reset(initialLink)
      if (initialResolution) flow.resolved(initialResolution, initialLink)
    }
    if (initialPlaceId) flow.selectPlace(initialPlaceId)
    return flow
  })
  useEffect(() => controller.configure(online, registered), [controller, online, registered])
  // T13: the controller follows #526's transport lifetime. Its synchronous reset
  // invalidates effect tickets; the epoch key also clears local form/mutation UI.
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { controller.mount(); return controller.dispose }, [controller])
  useEffect(() => {
    if (registered && online && state.googlePlaceId) void controller.refreshList()
  }, [controller, registered, online, state.googlePlaceId])
  useEffect(() => {
    if (!state.draft || state.sessionEpoch !== getSessionGeneration()) return
    const scope = captureSessionScope(state.sessionEpoch)
    const timeout = setTimeout(() => controller.expireActive(), Math.min(2_147_483_647, Math.max(0, Date.parse(state.draft.expiresAt) - Date.now())))
    const cancel = () => clearTimeout(timeout)
    scope.signal.addEventListener('abort', cancel, { once: true })
    return () => { cancel(); scope.signal.removeEventListener('abort', cancel) }
  }, [controller, state.draft, state.sessionEpoch])
  return <Context.Provider key={state.sessionEpoch} value={controller}>{children}</Context.Provider>
}
export const useOptionalImportFlow = () => useContext(Context)
export function useImportFlow() {
  const controller = useContext(Context)
  if (!controller) throw new Error('Import flow requires ImportFlowProvider')
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return { controller, state }
}
