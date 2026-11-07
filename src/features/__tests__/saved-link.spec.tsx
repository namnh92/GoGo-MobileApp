import { act, fireEvent } from '@testing-library/react-native'
import { renderScreen } from './harness'
import { SavedLink } from '@/features/tabs/saved-link.view'
const mockPush = jest.fn()
const mockResolve = jest.fn()
const mockSave = jest.fn()
const mockFeedback = jest.fn()
let mockSaved: unknown[] = []
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => ({ mutateAsync: mockResolve }),
  useToggleSaved: () => ({ mutateAsync: mockSave }),
  useSaved: () => ({ data: mockSaved }),
}))
beforeEach(() => {
  jest.clearAllMocks()
  mockSaved = []
  mockResolve.mockResolvedValue({ status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' })
  mockSave.mockResolvedValue({})
})
async function enterAndSave(url: string) {
  const view = await renderScreen(<SavedLink onFeedback={mockFeedback} />)
  await fireEvent.changeText(view.getByTestId('saved-link-input'), url)
  await fireEvent.press(view.getByText('Lưu'))
  return view
}
it('saves an existing GoGo place immediately with inline feedback', async () => {
  await enterAndSave('https://maps.app.goo.gl/cafe')
  expect(mockSave).toHaveBeenCalledWith({ type: 'place', id: 'canonical', saved: false })
  expect(mockFeedback).toHaveBeenCalledWith('Đã lưu địa điểm')
  expect(mockPush).not.toHaveBeenCalled()
})
it('keeps an already saved place saved', async () => {
  mockSaved = [{ targetType: 'place', targetId: 'canonical' }]
  await enterAndSave('https://maps.app.goo.gl/cafe')
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockFeedback).toHaveBeenCalled()
})
it('opens the real add-place flow with a prefilled link for a new place', async () => {
  mockResolve.mockResolvedValue({ status: 'RESOLVED', candidate: { name: 'New café' } })
  await enterAndSave('https://maps.app.goo.gl/new')
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/import', params: { url: 'https://maps.app.goo.gl/new' } })
})
it('rejects TikTok and Instagram before resolving', async () => {
  const view = await enterAndSave('https://instagram.com/place')
  expect(mockResolve).not.toHaveBeenCalled()
  expect(view.getByText('Chỉ hỗ trợ link Google Maps.')).toBeTruthy()
})
it('shows a shared result error and never claims a failed save succeeded', async () => {
  mockSave.mockRejectedValue(new Error('offline'))
  const view = await enterAndSave('https://maps.app.goo.gl/cafe')
  expect(view.getByText('Chưa lưu được địa điểm')).toBeTruthy()
  expect(mockFeedback).not.toHaveBeenCalled()
})

it('does not save or navigate if the user leaves while link resolution is pending', async () => {
  let finish: (value: unknown) => void = () => {}
  mockResolve.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = await enterAndSave('https://maps.app.goo.gl/pending')
  await view.unmount()
  await act(async () => { finish({ status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' }) })
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockFeedback).not.toHaveBeenCalled()
})
