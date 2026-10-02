import { within } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-BE#637 / #295 — the Kế hoạch card carries the room budget in its meta
 * line, right after the people count ("2 người · 800k/người", #293 §3).
 * The amount is integer minor units and always leaves with its unit; a total
 * is never divided into a per-head figure; no budget, no line.
 */
const mockQuery = {
  data: { pages: [{ items: [
    { id: 'pp', title: 'Nhóm theo đầu người', status: 'collecting', type: 'group', participantCount: 4,
      budget: { mode: 'per_person', amount: 800000, currency: 'VND' } },
    { id: 'gt', title: 'Nhóm tổng', status: 'collecting', type: 'group', participantCount: 4,
      budget: { mode: 'total', amount: 2000000, currency: 'VND' } },
    { id: 'cp', title: 'Hẹn hò', status: 'collecting', type: 'couple', participantCount: 2,
      budget: { mode: 'total', amount: 1500000, currency: 'VND' } },
    { id: 'nb', title: 'Chưa có điều kiện', status: 'draft', type: 'group', participantCount: 3 },
  ] }] },
  isPending: false, isError: false, isFetching: false, isFetchingNextPage: false,
  hasNextPage: false, isFetchNextPageError: false, error: null, dataUpdatedAt: 0,
  fetchNextPage: jest.fn(), refetch: jest.fn(),
}
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: () => undefined }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useMyRooms: () => mockQuery }))

import PlansScreen from '@/features/tabs/plans.view'

async function metaOf(roomId: string) {
  const view = await renderScreen(<PlansScreen />)
  const card = view.getByTestId(`plan-card-${roomId}`)
  return within(card).getByTestId('plan-card-meta')
}

it('per_person: the amount carries "/người", right after the people count', async () => {
  const meta = await metaOf('pp')
  expect(meta).toHaveTextContent(/^4 người · 800k\/người · /)
  expect(meta.props.accessibilityLabel).toMatch(/^4 người, Ngân sách 800k mỗi người, /)
})

it('total, group: the whole amount says it is a total — never divided', async () => {
  const meta = await metaOf('gt')
  expect(meta).toHaveTextContent(/^4 người · 2tr tổng · /)
  expect(meta).not.toHaveTextContent(/500k/)
  expect(meta.props.accessibilityLabel).toMatch(/^4 người, Ngân sách tổng 2tr cho 4 người, /)
})

it('total, couple: a couple budget is a total for both', async () => {
  const meta = await metaOf('cp')
  expect(meta).toHaveTextContent(/^cho 2 người · 1,5tr tổng · /)
  expect(meta).not.toHaveTextContent(/750k/)
  expect(meta.props.accessibilityLabel).toMatch(/^cho 2 người, Ngân sách tổng 1,5tr cho 2 người, /)
})

it('no budget: the line is omitted, never placeholdered', async () => {
  const meta = await metaOf('nb')
  expect(meta).toHaveTextContent(/^3 người · [^·]*$/)
  expect(meta.props.accessibilityLabel).not.toMatch(/Ngân sách/)
})
