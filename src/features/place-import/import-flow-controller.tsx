import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { listContributionDrafts, getContributionDraft, saveContributionDraft, deleteContributionDraft, submitPlace, resolveGoogleMapsLink, newIdempotencyKey } from '@/shared/api'
import { track } from '@/shared/analytics'
import { ImportFlowController } from './import-flow'

const Context = createContext<ImportFlowController | null>(null)
export function ImportFlowProvider({ children, online, registered, initialPlaceId }: {
  children: ReactNode; online: boolean; registered: boolean; initialPlaceId?: string
}) {
  const [controller] = useState(() => {
    const flow = new ImportFlowController({
      uuid: newIdempotencyKey, now: Date.now, list: listContributionDrafts, read: getContributionDraft,
      save: ({ id, body }) => saveContributionDraft(id, body), remove: ({ id, version }) => deleteContributionDraft(id, version),
      submit: submitPlace, resolve: resolveGoogleMapsLink, report: track,
    })
    if (initialPlaceId) flow.selectPlace(initialPlaceId)
    return flow
  })
  useEffect(() => controller.configure(online, registered), [controller, online, registered])
  // T13 INTEGRATION POINT (#525): inject the shared transport session epoch and
  // cancellation guard here, RESET_FLOW and purge epoch caches on change. A key
  // or userId comparison cannot protect refresh/replay or A -> B -> A.
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { controller.mount(); return controller.dispose }, [controller])
  useEffect(() => {
    if (registered && online && state.googlePlaceId) void controller.refreshList()
  }, [controller, registered, online, state.googlePlaceId])
  useEffect(() => {
    if (!state.draft) return
    const timeout = setTimeout(() => controller.expireActive(), Math.min(2_147_483_647, Math.max(0, Date.parse(state.draft.expiresAt) - Date.now())))
    return () => clearTimeout(timeout)
  }, [controller, state.draft])
  return <Context.Provider value={controller}>{children}</Context.Provider>
}
export const useOptionalImportFlow = () => useContext(Context)
export function useImportFlow() {
  const controller = useContext(Context)
  if (!controller) throw new Error('Import flow requires ImportFlowProvider')
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return { controller, state }
}
