import { create } from 'zustand'

import type { AssistantContext } from '@/shared/api/types'

/**
 * GoGo AI drafts (GoGo-MobileApp#378): what is typed in the composer and the
 * messages that have not reached the server yet. Neither is server state — a
 * message the server never accepted exists only here — so Zustand is the
 * place (CLAUDE.md). Once the server answers 202 the turn moves into the
 * TanStack cache and leaves this store.
 *
 * In memory only, and emptied on logout (`purgeCachedUserData`): a draft
 * question belongs to the account that typed it.
 */

/** A picked image, already uploaded (`uploadKey`) or not. */
export interface OutgoingImage {
  uri: string
  uploadKey: string
}

export interface OutgoingMessage {
  localId: string
  /** `null` until the conversation exists (a first message from Welcome). */
  conversationId: string | null
  text: string
  context?: AssistantContext
  images: OutgoingImage[]
  /** Kept for every retry of this message: the server returns the same turns. */
  idempotencyKey: string
  /** Kept as well, so a retried first message does not create a second conversation. */
  createKey: string
  status: 'sending' | 'failed'
  error?: unknown
  createdAt: string
}

/** Composer drafts by conversation; Welcome writes under `NEW_CHAT`. */
export const NEW_CHAT = 'new'

interface AssistantDraftState {
  drafts: Record<string, string>
  outgoing: OutgoingMessage[]
  setDraft: (key: string, text: string) => void
  addOutgoing: (message: OutgoingMessage) => void
  updateOutgoing: (localId: string, patch: Partial<OutgoingMessage>) => void
  removeOutgoing: (localId: string) => void
  reset: () => void
}

export const useAssistantDraftStore = create<AssistantDraftState>()(set => ({
  drafts: {},
  outgoing: [],
  setDraft: (key, text) => set(state => ({ drafts: { ...state.drafts, [key]: text } })),
  addOutgoing: message => set(state => ({ outgoing: [...state.outgoing, message] })),
  updateOutgoing: (localId, patch) =>
    set(state => ({ outgoing: state.outgoing.map(item => (item.localId === localId ? { ...item, ...patch } : item)) })),
  removeOutgoing: localId => set(state => ({ outgoing: state.outgoing.filter(item => item.localId !== localId) })),
  reset: () => set({ drafts: {}, outgoing: [] }),
}))

export function resetAssistantDrafts(): void {
  useAssistantDraftStore.getState().reset()
}
