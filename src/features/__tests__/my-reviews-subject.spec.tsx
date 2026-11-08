import { fireEvent, within } from '@testing-library/react-native'

import { failed, loaded, pending, renderScreen, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#469 — a card on "Đánh giá của tôi" must say what was reviewed.
 * A place review names the place and its address; a review with no `placeId` is
 * a review of the whole date. A failed place read never breaks the list or the
 * edit action.
 */

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: { datasetVersion: '2026-11' } }),
  useAdministrativeUnits: () => ({ data: [{ code: '01', fullName: 'Thành phố Hà Nội' }] }),
}))

let mockReviews: QueryLike
let mockPlace: QueryLike
let mockPlan: QueryLike
const mockUpdate = jest.fn(async () => ({}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMyReviews: () => mockReviews,
  useUpdateReview: () => ({ mutateAsync: mockUpdate, isPending: false }),
  usePlaceDetail: () => mockPlace,
  usePlan: () => mockPlan,
}))

import MyReviewsScreen from '@/features/review/my-reviews.view'

const CREATED = '2026-09-12T05:00:00.000Z'

function review(id: string, over: Record<string, unknown> = {}) {
  return { id, rating: 4, text: `Nội dung ${id}`, status: 'published', createdAt: CREATED, ...over }
}

async function editWorks(view: Awaited<ReturnType<typeof renderScreen>>) {
  await fireEvent.press(view.getByText('Sửa đánh giá'))
  expect(view.getByText('Lưu')).toBeTruthy()
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdate).toHaveBeenCalledWith({ id: 'r1', rating: 4, text: 'Nội dung r1' })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPlace = pending()
  mockPlan = pending()
})

describe('my reviews: card subject', () => {
  it('uses the same normalized address in the review subject and its accessibility label', async () => {
    mockReviews = loaded([review('r1', { placeId: 'place-1' })])
    mockPlace = loaded({
      id: 'place-1', name: 'Quán thử',
      addressText: '79 P. Lý Nam Đế, phường, Hoàn Kiếm, Hà Nội 100000',
      areaSummary: { label: 'Hoàn Kiếm', provinceCode: '01', communeCode: '00001' },
    })
    const view = await renderScreen(<MyReviewsScreen />)
    const address = '79 P. Lý Nam Đế, Hoàn Kiếm, Hà Nội'
    expect(view.getByText(address)).toBeTruthy()
    expect(within(view.getByTestId('my-review-subject')).getByTestId('place-card-open-target').props.accessibilityLabel).toBe(`Quán thử, ${address}`)
    expect(view.getByLabelText(address)).toBeTruthy()
  })

  it('names the place and its address, opens the place, and still edits', async () => {
    mockReviews = loaded([review('r1', { placeId: 'place-1' })])
    mockPlace = loaded({ id: 'place-1', name: 'Quán thử', addressText: '12 Ngô Đức Kế, Quận 1' })
    const view = await renderScreen(<MyReviewsScreen />)

    expect(view.getByText('Quán thử')).toBeTruthy()
    expect(view.getByText('12 Ngô Đức Kế, Quận 1')).toBeTruthy()
    expect(view.getByText('Đã hiển thị')).toBeTruthy()
    expect(view.getByText('Bạn chấm 4/5')).toBeTruthy()

    await fireEvent.press(within(view.getByTestId('my-review-subject')).getByTestId('place-card-open-target'))
    expect(mockPush).toHaveBeenCalledWith('/places/place-1')

    await editWorks(view)
  })

  it('says "Cả buổi hẹn" for a review without a place, with the plan date, and still edits', async () => {
    mockReviews = loaded([review('r1', { planId: 'plan-1' })])
    mockPlan = loaded({ id: 'plan-1', createdAt: '2026-09-10T05:00:00.000Z' })
    const view = await renderScreen(<MyReviewsScreen />)

    expect(view.getByText('Cả buổi hẹn')).toBeTruthy()
    expect(view.getByText(/Kế hoạch tạo ngày/)).toBeTruthy()
    // Nothing to open: there is no place.
    await fireEvent.press(view.getByTestId('my-review-subject'))
    expect(mockPush).not.toHaveBeenCalled()

    await editWorks(view)
  })

  it('keeps the list and the edit action when the place read fails', async () => {
    mockReviews = loaded([review('r1', { placeId: 'place-1' }), review('r2', { status: 'pending' })])
    mockPlace = failed()
    const view = await renderScreen(<MyReviewsScreen />)

    expect(view.getAllByText('Không tải được tên và địa chỉ địa điểm').length).toBeGreaterThan(0)
    expect(view.getByText('Nội dung r2')).toBeTruthy()

    // The place is still known by id, so the subject still opens it.
    await fireEvent.press(within(view.getAllByTestId('my-review-subject')[0]).getByTestId('place-card-open-target'))
    expect(mockPush).toHaveBeenCalledWith('/places/place-1')

    await fireEvent.press(view.getAllByText('Sửa đánh giá')[0])
    await fireEvent.press(view.getByText('Lưu'))
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'r1', rating: 4, text: 'Nội dung r1' })
  })
})

describe('my reviews: status filter', () => {
  it('counts and filters the loaded list on the client', async () => {
    mockReviews = loaded([
      review('r1', { placeId: 'p' }),
      review('r2', { status: 'pending' }),
      review('r3', { status: 'rejected' }),
      review('r4'),
    ])
    mockPlace = loaded({ id: 'p', name: 'Quán thử' })
    const view = await renderScreen(<MyReviewsScreen />)

    expect(view.getByText('Tất cả (4)')).toBeTruthy()
    expect(view.getByText('Đã hiển thị (2)')).toBeTruthy()
    await fireEvent.press(view.getByText('Chờ duyệt (1)'))
    expect(view.getByText('Chờ duyệt (1)')).toBeTruthy()
    expect(view.getByText('Nội dung r2')).toBeTruthy()
    expect(view.queryByText('Nội dung r1')).toBeNull()
  })
})
