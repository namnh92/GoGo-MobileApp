import { fireEvent, screen } from '@testing-library/react-native'
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
