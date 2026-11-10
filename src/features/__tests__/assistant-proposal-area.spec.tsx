import { act, waitFor } from '@testing-library/react-native'

import type { AssistantProposal } from '@/shared/api'
import { api } from '@/shared/api/client'
import i18n from '@/shared/i18n'
import { ConfirmationCard } from '@/features/assistant/confirmation-card.view'
import { TaskSummary } from '@/features/assistant/task-summary.view'
import { proposalRows } from '@/features/assistant/proposal-rows'

import { renderScreen } from './harness'

const area = { datasetVersion: 'v1', provinceCode: '79', communeCode: '26734' }
const values: AssistantProposal['values'] = [
  { field: 'administrativeArea', value: area, editable: true, origin: 'explicit' },
  { field: 'seedPlaceIds', value: ['place-a', 'place-b'], editable: true, origin: 'explicit' },
]
const proposal = { id: 'proposal-area', kind: 'create_room', status: 'pending', values } as AssistantProposal
const context = { locale: 'vi', placeNames: new Map([['place-a', 'Nhà Lá Café']]) }
const province = { code: '79', fullName: 'Thành phố Hồ Chí Minh', level: 'PROVINCE', isCurrent: true, status: 'ACTIVE' }
const commune = { code: '26734', fullName: 'Phường Thảo Điền', parentCode: '79', level: 'COMMUNE', isCurrent: true, status: 'ACTIVE' }

function backend(version = 'v1', parentCode = '79') {
  return jest.spyOn(api, 'get').mockImplementation(async (path: string) => {
    if (path === '/administrative/provinces') return { datasetVersion: version, items: [province], nextCursor: null, total: 1 }
    if (path === '/administrative/provinces/{provinceCode}/communes') return { datasetVersion: version, items: [{ ...commune, parentCode }], nextCursor: null, total: 1 }
    throw new Error(`Unexpected endpoint: ${path}`)
  })
}

function card(cardValues: AssistantProposal['values'] = values) {
  return <ConfirmationCard proposal={{ ...proposal, values: cardValues }} context={context} confirming={false} dismissing={false} error={null} onConfirm={jest.fn()} onDismiss={jest.fn()} />
}

afterEach(async () => { jest.restoreAllMocks(); await act(async () => { await i18n.changeLanguage('vi') }) })

it('resolves official ward/province names through existing BFF endpoints, without JSON or technical keys', async () => {
  const get = backend()
  const view = await renderScreen(card())
  await waitFor(() => expect(view.getByText('Phường Thảo Điền, Thành phố Hồ Chí Minh')).toBeTruthy())
  expect(view.getByText('Khu vực')).toBeTruthy()
  expect(view.getByText('2 địa điểm gợi ý')).toBeTruthy()
  expect(view.queryByText(/administrativeArea|seedPlaceIds|datasetVersion|\{/)).toBeNull()
  expect(get).toHaveBeenCalledWith('/administrative/provinces/{provinceCode}/communes', expect.objectContaining({ pathParams: { provinceCode: '79' }, anonymous: true }))
})

it('renders a province-only area and English count/labels', async () => {
  backend()
  await act(async () => { await i18n.changeLanguage('en') })
  const view = await renderScreen(card([{ field: 'administrativeArea', value: { ...area, communeCode: null }, editable: false, origin: 'explicit' }, { field: 'seedPlaceIds', value: ['place-a'], editable: false, origin: 'explicit' }]))
  await waitFor(() => expect(view.getByText('Thành phố Hồ Chí Minh')).toBeTruthy())
  expect(view.getByText('Area')).toBeTruthy()
  expect(view.getByText('1 suggested place')).toBeTruthy()
})

it.each(['version', 'parent', 'network'])('does not invent names or leak JSON on %s failure', async reason => {
  if (reason === 'network') jest.spyOn(api, 'get').mockRejectedValue(new Error('offline'))
  else backend(reason === 'version' ? 'v2' : 'v1', reason === 'parent' ? '01' : '79')
  const view = await renderScreen(card())
  await waitFor(() => expect(view.getByText('Không tải được tên khu vực')).toBeTruthy())
  expect(view.queryByText(/Phường Thảo Điền|administrativeArea|seedPlaceIds|\{/)).toBeNull()
  expect(view.getByText('2 địa điểm gợi ý')).toBeTruthy()
})

it('uses the same safe rows for saved task summaries', async () => {
  backend()
  const view = await renderScreen(<TaskSummary result={{ proposalId: proposal.id, confirmedAt: '2026-11-10T03:00:00Z', kind: 'create_room', resource: { type: 'room', id: 'room-1' }, savedValues: values }} context={context} onOpenRoom={jest.fn()} />)
  await waitFor(() => expect(view.getByText('Phường Thảo Điền, Thành phố Hồ Chí Minh')).toBeTruthy())
  expect(view.getByText('2 địa điểm gợi ý')).toBeTruthy()
})

it('shows localized loading copy while official names are pending', async () => {
  jest.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
  const view = await renderScreen(card())
  expect(view.getByText('Đang tải tên khu vực…')).toBeTruthy()
  expect(view.queryByText(/administrativeArea|seedPlaceIds|\{/)).toBeNull()
})

it('handles a missing official unit without displaying codes or guessed names', async () => {
  jest.spyOn(api, 'get').mockResolvedValue({ datasetVersion: 'v1', items: [], nextCursor: null, total: 0 })
  const view = await renderScreen(card())
  await waitFor(() => expect(view.getByText('Không tải được tên khu vực')).toBeTruthy())
  expect(view.queryByText(/26734|administrativeArea|\{/)).toBeNull()
})

it('never renders unrecognized technical fields/objects or invents a zero budget', () => {
  const rows = proposalRows([
    { field: 'futureField', value: { private: 'raw' } },
    { field: 'futureScalar', value: 'internal' },
    { field: 'title', value: { nested: true } },
    { field: 'budgetAmount', value: null },
    { field: 'budgetMode', value: 'per_person' },
  ], { ...context, t: i18n.t })
  expect(JSON.stringify(rows)).not.toMatch(/futureField|futureScalar|private|nested|0 \/ người|per_person/)
})
