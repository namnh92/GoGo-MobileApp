import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { expect, it } from 'vitest'
import type { AssistantStatus, AssistantConversationCredits, AssistantTurnCredits, AssistantInsufficientCreditDetails, components } from '../types'

it('pins the D contract and required full-conversation/insufficient-credit facts', () => {
  const contract = readFileSync(new URL('../../../../openapi/gogo.v1.yaml', import.meta.url), 'utf8')
  expect(contract).toMatch(/version: 10\.0\.0-alpha\.1/)
  for (const schema of ['AssistantTurnCredits', 'AssistantConversationCredits', 'AssistantInsufficientCreditDetails']) {
    expect(contract).toContain(`    ${schema}:`)
  }
  const status: AssistantStatus = { state: 'enabled', dailyMessageLimit: 3, remainingToday: 2, resetsAt: '2026-11-11T17:00:00Z',
    creditBalance: 0, creditReserved: 0, creditAvailable: 0, creditPolicy: 'free_then_actual_cost_v1', paidCreditsRequired: null, paidSendEnabled: false, asOf: '2026-11-11T00:00:00Z' }
  const conversation: AssistantConversationCredits = { creditsUsed: null, creditsReserved: 5, pendingTurns: 1, state: 'unavailable', asOf: status.asOf }
  const turn: AssistantTurnCredits = { policyKey: status.creditPolicy, fundingSource: 'credit', state: 'pending', creditsCharged: 0, creditsReserved: 5, updatedAt: status.asOf }
  const details: AssistantInsufficientCreditDetails = { creditBalance: 8, creditReserved: 5, creditAvailable: 3, requiredCredits: 12, remainingToday: 0, resetsAt: status.resetsAt }
  const entry: components['schemas']['MyCreditEntry'] = { id: 'e', createdAt: status.asOf, delta: 4, direction: 'adjustment', eventKey: 'assistant_usage_adjustment', source: { type: 'assistant_usage' }, conversation: { id: 'c', title: null }, eventLabels: null }
  expect({ status, conversation, turn, details, entry }).toMatchObject({ status: { creditBalance: 0, remainingToday: 2 }, conversation: { creditsUsed: null }, turn: { creditsReserved: 5 }, details: { requiredCredits: 12 }, entry: { delta: 4 } })
})
