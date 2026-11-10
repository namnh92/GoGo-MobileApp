import { act, fireEvent, render, screen } from '@testing-library/react-native'

import type { AssistantProposal, AssistantProposalResult } from '@/shared/api'
import i18n from '@/shared/i18n'
import { ConfirmationCard } from '@/features/assistant/confirmation-card.view'
import { TaskSummary } from '@/features/assistant/task-summary.view'

// #401: unknown budgets are omitted (core.md 13), including the zero
// placeholder that used to read "0 / người" with an AI-assumed hint.
function proposal(amount: unknown, mode: unknown = 'per_person'): AssistantProposal {
  return {
    id: 'budget-regression', kind: 'create_room', status: 'pending',
    createdAt: '2026-11-03T00:00:00Z', expiresAt: '2026-11-03T00:30:00Z',
    values: [
      { field: 'title', value: 'Weekend', origin: 'explicit', editable: true },
      ...(amount === undefined ? [] : [{ field: 'budgetAmount', value: amount, origin: 'assumed' as const, editable: true }]),
      ...(mode === undefined ? [] : [{ field: 'budgetMode', value: mode, origin: 'assumed' as const, editable: true }]),
    ],
  }
}

async function show(data: AssistantProposal, surface: 'proposal' | 'summary', locale: string, onConfirm = jest.fn()) {
  const context = { locale, placeNames: new Map<string, string>() }
  if (surface === 'proposal') {
    await render(<ConfirmationCard proposal={data} context={context} confirming={false} dismissing={false}
      error={null} onConfirm={onConfirm} onDismiss={jest.fn()} />)
  } else {
    const result: AssistantProposalResult = {
      proposalId: data.id, kind: data.kind, resource: { type: 'room', id: 'room-1' },
      savedValues: data.values.map(({ field, value }) => ({ field, value })),
      confirmedAt: '2026-11-03T00:01:00Z',
    }
    await render(<TaskSummary result={result} context={context} onOpenRoom={jest.fn()} />)
  }
}

afterAll(async () => { await i18n.changeLanguage('vi') })

describe.each(['vi', 'en'])('%s budget copy', locale => {
  beforeEach(async () => { await i18n.changeLanguage(locale) })

  describe.each(['proposal', 'summary'] as const)('%s', surface => {
    it.each([
      ['missing', undefined], ['null', null], ['zero', 0], ['negative', -1],
      ['fractional minor units', 1.5], ['NaN', NaN], ['infinite', Infinity],
      ['string', '300000'], ['object', { amount: 300000 }],
    ])('omits an unknown/invalid amount: %s, including its hint and accessibility row', async (_name, amount) => {
      await show(proposal(amount), surface, locale)
      expect(screen.getByText('Weekend')).toBeTruthy()
      expect(screen.queryByText(i18n.t('assistant.field.budget'))).toBeNull()
      expect(screen.queryByLabelText(new RegExp(`^${i18n.t('assistant.field.budget')},`))).toBeNull()
      expect(screen.queryByText(/0 \/ (người|person)/)).toBeNull()
      expect(screen.queryByText(i18n.t('assistant.proposal.assumed', { field: i18n.t('assistant.field.budget') }))).toBeNull()
      // Neither field may leak through the generic field/JSON fallback.
      expect(screen.queryByText('budgetAmount')).toBeNull()
      expect(screen.queryByText('budgetMode')).toBeNull()
      expect(screen.queryByText('per_person')).toBeNull()
      expect(screen.queryByText('{"amount":300000}')).toBeNull()
    })

    it.each([undefined, null, 'unknown', { mode: 'total' }])('omits an amount whose scope is unknown: %p', async mode => {
      const data = proposal(300000)
      data.values = data.values.filter(value => value.field !== 'budgetMode')
      if (mode !== undefined) data.values.push({ field: 'budgetMode', value: mode, origin: 'assumed', editable: true })
      await show(data, surface, locale)
      expect(screen.queryByText(i18n.t('assistant.field.budget'))).toBeNull()
      expect(screen.queryByText('budgetMode')).toBeNull()
      expect(screen.queryByText('{"mode":"total"}')).toBeNull()
    })

    it.each(['per_person', 'total'])('preserves a positive integer budget and its %s unit', async mode => {
      const data = proposal(300000, mode)
      await show(data, surface, locale)
      const value = i18n.t(mode === 'per_person' ? 'assistant.value.budgetPerPerson' : 'assistant.value.budgetTotal', { amount: '300k' })
      expect(screen.getByText(value)).toBeTruthy()
      const hint = i18n.t('assistant.proposal.assumed', { field: i18n.t('assistant.field.budget') })
      expect(screen.getByLabelText([i18n.t('assistant.field.budget'), value, ...(surface === 'proposal' ? [hint] : [])].join(', '))).toBeTruthy()
    })
  })

  it('hides the zero placeholder without editing the proposal or confirm payload', async () => {
    const data = proposal(0)
    const original = JSON.stringify(data)
    const confirm = jest.fn()
    await show(data, 'proposal', locale, confirm)
    await act(async () => { await fireEvent.press(screen.getByRole('button', { name: i18n.t('assistant.proposal.confirm.create_room') })) })
    expect(confirm).toHaveBeenCalledWith(undefined)
    expect(JSON.stringify(data)).toBe(original)
  })
})
