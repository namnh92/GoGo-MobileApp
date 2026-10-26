import { isAssistantMockOn } from '@/shared/config/features'

import * as http from './endpoints/assistant'
import { createHttpAssistantStreamOpener, type OpenAssistantStream } from './realtime/assistant-stream'
import type {
  AssistantConversation,
  AssistantConversationPage,
  AssistantFeedback,
  AssistantFeedbackInput,
  AssistantMessage,
  AssistantMessagePage,
  AssistantMessageSend,
  AssistantProposal,
  AssistantProposalResult,
  AssistantStatus,
  AssistantTurn,
  OpBody,
} from './types'

/**
 * Everything GoGo AI asks of the server (GoGo-MobileApp#378), as one port.
 *
 * The app ships `httpAssistantBackend`: the generated `/v1/assistant/*`
 * operations plus the SSE opener. The assistant API is declared
 * (GoGo-BE#713, contract 2.0.0-alpha.3) but not served yet, so a dev-flavour
 * debug build answers from a scripted, in-memory backend in `src/data` —
 * the "mock fixtures until the real API lands" the repo keeps there. It is
 * loaded with `require` only when `isAssistantMockOn()` says so (dev flavour,
 * `__DEV__`, `EXPO_PUBLIC_ASSISTANT_MOCK` not `off`); stag and prod never call
 * it. Tests install their own with `setAssistantBackend`.
 */
export interface AssistantBackend {
  getStatus(): Promise<AssistantStatus>
  listConversations(query: { q?: string; cursor?: string; limit?: number }): Promise<AssistantConversationPage>
  createConversation(body: OpBody<'createAssistantConversation'>, idempotencyKey: string): Promise<AssistantConversation>
  renameConversation(id: string, title: string): Promise<AssistantConversation>
  deleteConversation(id: string): Promise<void>
  listMessages(id: string, query: { cursor?: string; limit?: number }): Promise<AssistantMessagePage>
  sendMessage(id: string, body: AssistantMessageSend, idempotencyKey: string): Promise<AssistantTurn>
  stopMessage(id: string, messageId: string): Promise<AssistantMessage>
  setFeedback(id: string, messageId: string, body: AssistantFeedbackInput): Promise<AssistantFeedback>
  clearFeedback(id: string, messageId: string): Promise<void>
  getProposal(proposalId: string): Promise<AssistantProposal>
  confirmProposal(proposalId: string, values: Record<string, unknown> | undefined, idempotencyKey: string): Promise<AssistantProposalResult>
  dismissProposal(proposalId: string): Promise<AssistantProposal>
  openStream: OpenAssistantStream
}

export const httpAssistantBackend: AssistantBackend = {
  getStatus: () => http.getAssistantStatus(),
  listConversations: query => http.listAssistantConversations(query),
  createConversation: (body, key) => http.createAssistantConversation(body, key),
  renameConversation: (id, title) => http.renameAssistantConversation(id, { title }),
  deleteConversation: id => http.deleteAssistantConversation(id),
  listMessages: (id, query) => http.listAssistantMessages(id, query),
  sendMessage: (id, body, key) => http.sendAssistantMessage(id, body, key),
  stopMessage: (id, messageId) => http.stopAssistantMessage(id, messageId),
  setFeedback: (id, messageId, body) => http.setAssistantMessageFeedback(id, messageId, body),
  clearFeedback: (id, messageId) => http.clearAssistantMessageFeedback(id, messageId),
  getProposal: proposalId => http.getAssistantProposal(proposalId),
  confirmProposal: (proposalId, values, key) =>
    http.confirmAssistantProposal(proposalId, values ? { values } : {}, key),
  dismissProposal: proposalId => http.dismissAssistantProposal(proposalId),
  openStream: createHttpAssistantStreamOpener(),
}

let installed: AssistantBackend | null = null

function loadDevBackend(): AssistantBackend {
  // Dev-flavour debug builds only (see `isAssistantMockOn`). A relative path:
  // `src/data` is not part of the API layer's public surface.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('../../data/assistant/mock-backend') as typeof import('../../data/assistant/mock-backend')
  return mock.createMockAssistantBackend()
}

export function getAssistantBackend(): AssistantBackend {
  if (!installed) installed = isAssistantMockOn() ? loadDevBackend() : httpAssistantBackend
  return installed
}

/** Tests (and only tests) swap the backend; `null` goes back to the default choice. */
export function setAssistantBackend(backend: AssistantBackend | null): void {
  installed = backend
}
