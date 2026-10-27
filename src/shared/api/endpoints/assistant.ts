import { api } from '../client'
import type { OpBody, OpQuery, OpResponse } from '../types'

/**
 * GoGo AI (`/v1/assistant/*`, GoGo-BE#713 contract 2.0.0-alpha.3). Thin
 * wrappers over the generated operations; every signature derives from the
 * vendored spec, so a contract change fails the typecheck here.
 *
 * The reply itself is not here: `POST …/messages` answers 202 with the two
 * turns, and the text arrives on the SSE stream (`realtime/assistant-stream`).
 */

export function getAssistantStatus(): Promise<OpResponse<'getAssistantStatus'>> {
  return api.get('/assistant/status')
}

export function listAssistantConversations(
  query: OpQuery<'listAssistantConversations'>,
): Promise<OpResponse<'listAssistantConversations'>> {
  return api.get('/assistant/conversations', { query })
}

export function createAssistantConversation(
  body: OpBody<'createAssistantConversation'>,
  idempotencyKey: string,
): Promise<OpResponse<'createAssistantConversation'>> {
  return api.post('/assistant/conversations', body, { idempotencyKey })
}

export function getAssistantConversation(id: string): Promise<OpResponse<'getAssistantConversation'>> {
  return api.get('/assistant/conversations/{id}', { pathParams: { id } })
}

export function renameAssistantConversation(
  id: string,
  body: OpBody<'renameAssistantConversation'>,
): Promise<OpResponse<'renameAssistantConversation'>> {
  return api.patch('/assistant/conversations/{id}', body, { pathParams: { id } })
}

export function deleteAssistantConversation(id: string): Promise<void> {
  return api.delete('/assistant/conversations/{id}', undefined, { pathParams: { id } })
}

export function listAssistantMessages(
  id: string,
  query: OpQuery<'listAssistantMessages'>,
): Promise<OpResponse<'listAssistantMessages'>> {
  return api.get('/assistant/conversations/{id}/messages', { pathParams: { id }, query })
}

/** `Idempotency-Key` is required: a retry after a flaky network returns the same two turns. */
export function sendAssistantMessage(
  id: string,
  body: OpBody<'sendAssistantMessage'>,
  idempotencyKey: string,
): Promise<OpResponse<'sendAssistantMessage'>> {
  return api.post('/assistant/conversations/{id}/messages', body, { pathParams: { id }, idempotencyKey })
}

export function stopAssistantMessage(id: string, messageId: string): Promise<OpResponse<'stopAssistantMessage'>> {
  return api.post('/assistant/conversations/{id}/messages/{messageId}/stop', undefined, {
    pathParams: { id, messageId },
  })
}

export function setAssistantMessageFeedback(
  id: string,
  messageId: string,
  body: OpBody<'setAssistantMessageFeedback'>,
): Promise<OpResponse<'setAssistantMessageFeedback'>> {
  return api.put('/assistant/conversations/{id}/messages/{messageId}/feedback', body, {
    pathParams: { id, messageId },
  })
}

export function clearAssistantMessageFeedback(id: string, messageId: string): Promise<void> {
  return api.delete('/assistant/conversations/{id}/messages/{messageId}/feedback', undefined, {
    pathParams: { id, messageId },
  })
}

export function getAssistantProposal(proposalId: string): Promise<OpResponse<'getAssistantProposal'>> {
  return api.get('/assistant/proposals/{proposalId}', { pathParams: { proposalId } })
}

/** The only assistant call that writes GoGo data. `Idempotency-Key` is required. */
export function confirmAssistantProposal(
  proposalId: string,
  body: OpBody<'confirmAssistantProposal'>,
  idempotencyKey: string,
): Promise<OpResponse<'confirmAssistantProposal'>> {
  return api.post('/assistant/proposals/{proposalId}/confirm', body, { pathParams: { proposalId }, idempotencyKey })
}

export function dismissAssistantProposal(proposalId: string): Promise<OpResponse<'dismissAssistantProposal'>> {
  return api.post('/assistant/proposals/{proposalId}/dismiss', undefined, { pathParams: { proposalId } })
}
