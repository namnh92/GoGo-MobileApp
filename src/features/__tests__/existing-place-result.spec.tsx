import { act, fireEvent, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import i18n from '@/shared/i18n'
import { ApiError } from '@/shared/api/errors'
import { failed, loaded, renderScreen, type QueryLike } from './harness'

let mockDetail: QueryLike
let mockStatus = 'user'
const mockToggle = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockDetail,
  useSaved: () => ({ data: [], isPending: false, isError: false }),
  useToggleSaved: () => ({ mutate: mockToggle, isPending: false }),
}))
import { ExistingPlaceResult } from '@/features/place-import/existing-place-result.view'

beforeEach(() => {
  mockStatus = 'user'
  mockDetail = loaded({ id: 'canonical', name: 'Quán GoGo', gogoRatingCount: 0 })
  jest.clearAllMocks()
})

it.each(['vi', 'en'])('F-22 keeps add-place result rating facts in %s', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    mockDetail = loaded({ id: 'canonical', name: 'Quán GoGo', rating: 4.5, ratingCount: 1395, gogoRatingCount: 0 })
    await renderScreen(<ExistingPlaceResult placeId="canonical" onReset={() => {}} />)
    expect(screen.getByTestId('place-gogo-rating')).toHaveTextContent(language === 'vi' ? 'GoGo · 0 đánh giá' : 'GoGo · 0 reviews')
    expect(screen.getByTestId('place-google-rating')).toHaveTextContent(language === 'vi' ? '★ 4,5 (1.395) Google' : '★ 4.5 (1,395) Google')
    for (const id of ['place-gogo-rating-count', 'place-gogo-rating-source', 'place-google-rating-count', 'place-google-rating-source']) {
      const fact = screen.getByTestId(id)
      expect(fact.props.numberOfLines).toBeUndefined()
      expect(fact.props.ellipsizeMode).toBeUndefined()
      expect(StyleSheet.flatten(fact.props.style).flexShrink).toBe(0)
    }
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})

it('opens and saves only the canonical GoGo ID', async () => {
  await renderScreen(<ExistingPlaceResult placeId="canonical" onReset={() => {}} />)
  await fireEvent.press(screen.getByText('Xem địa điểm'))
  expect(mockReplace).toHaveBeenCalledWith('/places/canonical')
  await fireEvent.press(screen.getByText('Lưu'))
  expect(mockToggle).toHaveBeenCalledWith({ type: 'place', id: 'canonical', saved: false })
})

it.each([404, 503])('keeps reset/retry available when canonical detail returns %s', async status => {
  mockDetail = failed(new ApiError(status, { code: 'PLACE_NOT_FOUND', message: 'Unavailable' }))
  await renderScreen(<ExistingPlaceResult placeId="canonical" onReset={() => {}} />)
  expect(screen.getByText('Thử lại')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  expect(screen.queryByText('Quán GoGo')).toBeNull()
})
