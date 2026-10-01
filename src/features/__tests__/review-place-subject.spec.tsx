import { fireEvent, waitFor } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#277 — FR-PLAN-007 asks for a review of each stop *and* of the
 * whole experience. The app only ever sent `{planId, rating, text}`, so every
 * review it created was stored with `place_id = null`, and a place's review
 * list (which filters on `place_id`) could never show anything written in the
 * app. `POST /reviews` has accepted an optional `placeId` all along
 * (`openapi/gogo.v1.yaml`, `createReview`), so the gap was the client's.
 */

const mockReplace = jest.fn()
const mockCreate = jest.fn(async () => ({ id: 'review-1', rating: 5, status: 'pending' }))

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))

const mockPlan = {
  id: 'plan-1',
  roomId: 'room-1',
  version: 3,
  status: 'current',
  stops: [
    { id: 'stop-1', placeId: 'place-1', position: 1, durationMinutes: 60, isLocked: false, status: 'completed' },
    { id: 'stop-2', placeId: 'place-2', position: 2, durationMinutes: 90, isLocked: false, status: 'completed' },
  ],
  totals: { costMin: 0, costMax: 0, currency: 'VND', durationMinutes: 150, travelDistanceM: 0 },
}

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => ({ isPending: false, isError: false, data: mockPlan, error: null, refetch: jest.fn() }),
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([
      ['place-1', { id: 'place-1', name: 'Quán A' }],
      ['place-2', { id: 'place-2', name: 'Quán B' }],
    ]),
    isPending: false,
  }),
  useCreateReview: () => ({ mutateAsync: mockCreate, isPending: false }),
}))

import ReviewScreen from '@/features/review/review.view'

const FIVE_STARS = '5 sao'
const SUBMIT = 'Gửi đánh giá'

beforeEach(() => {
  mockCreate.mockClear()
  mockReplace.mockClear()
})

it('files a stop review against that stop place', async () => {
  const view = await renderScreen(<ReviewScreen />)

  // The stop is a subject the user can choose; on the unfixed screen there is
  // no such control at all.
  await fireEvent.press(view.getByText('Quán A'))
  await fireEvent.press(view.getByLabelText(FIVE_STARS))
  await fireEvent.press(view.getByText(SUBMIT))

  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith({ planId: 'plan-1', placeId: 'place-1', rating: 5 }),
  )
})

it('keeps the whole-date review free of a place', async () => {
  const view = await renderScreen(<ReviewScreen />)

  // The default subject, and the only one the screen used to have. The chip
  // marks the selection with a check glyph, so read its accessibility label.
  expect(view.getByLabelText('Cả buổi hẹn')).toBeTruthy()
  await fireEvent.press(view.getByLabelText(FIVE_STARS))
  await fireEvent.press(view.getByText(SUBMIT))

  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ planId: 'plan-1', rating: 5 }))
})

it('offers the next unreviewed stop instead of ending the flow', async () => {
  const view = await renderScreen(<ReviewScreen />)

  await fireEvent.press(view.getByLabelText(FIVE_STARS))
  await fireEvent.press(view.getByText(SUBMIT))

  // After one review there are two stops left, so the flow does not dead-end
  // on "Continue".
  const another = await waitFor(() => view.getByText('Đánh giá Quán A'))
  await fireEvent.press(another)

  // A fresh form for the next subject: the stars from the previous review are
  // not carried over into a different place's rating.
  expect(view.getAllByText('Chọn số sao').length).toBeGreaterThan(0)
  await fireEvent.press(view.getByLabelText(FIVE_STARS))
  await fireEvent.press(view.getByText(SUBMIT))

  await waitFor(() =>
    expect(mockCreate).toHaveBeenLastCalledWith({ planId: 'plan-1', placeId: 'place-1', rating: 5 }),
  )
})
