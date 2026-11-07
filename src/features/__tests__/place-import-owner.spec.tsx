import { completeWizard } from './contribution-fixtures'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { Keyboard, Linking, ScrollView, StyleSheet, View } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { renderScreen } from './harness'

const mockResolve = { data: undefined as unknown, mutate: jest.fn(), reset: jest.fn(), isPending: false, isPaused: false, isError: false, error: null as unknown }
const mockSubmit = { mutateAsync: jest.fn(), reset: jest.fn() }
const mockClipboard = jest.fn()
jest.mock('expo-clipboard', () => ({ getStringAsync: () => mockClipboard() }))
const mockPick = jest.fn()
const mockPermission = jest.fn()
const mockGet = jest.fn()
const mockToggleSaved = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockPermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockPick(...args),
}))
jest.mock('@/shared/api/client', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }))
const mockRouter = { back: jest.fn(), push: jest.fn() }
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
const mockUnread = { count: 0, more: false }
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => mockUnread }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => mockResolve,
  useSubmitPlace: () => mockSubmit,
  usePlaceSubmission: () => ({}),
  ...jest.requireActual('./contribution-fixtures').contributionHooks(),
  usePlaceDetail: () => ({ data: { id: 'canonical', name: 'Existing' } }),
  useSaved: () => ({ data: [] }),
  useToggleSaved: () => ({ mutate: mockToggleSaved }),
}))
import { themes, type AppTheme } from '@/shared/ui/theme'
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles'
import PlaceImportScreen from '@/features/place-import/import.view'
const mockNow = { value: new Date('2026-11-07T05:00:00Z') }
jest.mock('@/shared/ui/use-place-clock', () => ({ usePlaceClock: () => mockNow.value }))
const LINK = 'https://maps.google.com/maps?place_id=ChIJtest'
const candidate = { googlePlaceId: 'ChIJtest', name: 'Preview' }
async function preview(value: unknown = candidate) {
  mockResolve.data = { status: 'RESOLVED', candidate: value }
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
}
beforeEach(() => {
  jest.clearAllMocks()
  mockNow.value = new Date('2026-11-07T05:00:00Z')
  mockUnread.count = 0
  onlineManager.setOnline(true)
  mockClipboard.mockResolvedValue('')
  mockResolve.isError = false
  mockResolve.isPaused = false
  mockResolve.error = null
  mockResolve.isPending = false
  mockResolve.data = undefined
  mockPermission.mockResolvedValue({ granted: true })
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///one.jpg' }] })
  mockSubmit.mutateAsync.mockResolvedValue({ status: 'PENDING', submissionId: 'pending' })
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('keeps a long URL single-line with a 44pt clear control; changing a verified link clears preview and metadata', async () => {
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK + '&long=' + 'a'.repeat(400))
  const input = screen.getByTestId('import-link-input')
  expect(input.props.multiline).toBe(false)
  expect(input.props.numberOfLines).toBe(1)
  const clear = screen.getByRole('button', { name: 'Xóa liên kết' })
  expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ width: 44, height: 44 })
  await fireEvent.press(clear)
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  expect(screen.queryByLabelText('Xóa liên kết')).toBeNull()
  mockResolve.data = { status: 'RESOLVED', candidate }
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  expect(screen.queryByTestId('import-link-input')).toBeNull()
  await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé'), 'old note')
  await fireEvent.press(screen.getByRole('button', { name: 'Đổi link' }))
  expect(screen.queryByText('Preview')).toBeNull()
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  await completeWizard()
  expect(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé').props.value).toBe('')
})

it('spaces the card/actions and individual buttons, and removes the lone entered-link control', async () => {
  mockResolve.data = { status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' }
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  expect(StyleSheet.flatten(screen.getByTestId('import-result-actions').props.style)).toMatchObject({ marginTop: 16, gap: 12 })
  expect(screen.queryByText('Liên kết đã nhập')).toBeNull()
})

it('shows the menu/bill upload visibly unavailable and never requests picker permission', async () => {
  await preview()
  await completeWizard()
  const button = screen.getByRole('button', { name: '+ Tải thêm ảnh menu/bill (Tối đa 5 ảnh)' })
  expect(button.props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button)
  expect(mockPermission).not.toHaveBeenCalled()
  expect(mockPick).not.toHaveBeenCalled()
  await completeWizard()
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ googlePlaceId: 'ChIJtest', enrichment: expect.not.objectContaining({ photos: expect.anything() }) }))
})

it('omits candidate imagery and performs no photo request when the contract field is absent', async () => {
  await preview()
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
  expect(screen.queryByTestId('place-photo-placeholder')).toBeNull()
  expect(mockGet).not.toHaveBeenCalled()
})

it('fetches the contract photo reference as JSON, displays returned bytes/credits without caching, and clears on edit', async () => {
  mockGet.mockResolvedValue({
    status: 'ok',
    attribution: 'Google Maps',
    photos: [{ contentType: 'image/jpeg', dataBase64: 'aGVsbG8=', authorAttributions: [{ displayName: 'Lan' }] }],
  })
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  await waitFor(() => expect(screen.getByTestId('import-candidate-photo')).toBeTruthy())
  expect(mockGet).toHaveBeenCalledTimes(1)
  expect(mockGet).toHaveBeenCalledWith('/places/google-provider-photo/ChIJtest', expect.objectContaining({ anonymous: true }))
  expect(screen.getByTestId('import-candidate-photo').props).toMatchObject({ source: [{ uri: 'data:image/jpeg;base64,aGVsbG8=' }], cachePolicy: 'none' })
  expect(screen.getByText('Ảnh: Lan · Google Maps')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Đổi link' }))
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK + '&new=1')
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
})

it.each(['https://evil.test/photo', '/places/google-provider-photo/OtherID'])('does not fetch an untrusted photo reference %s', async url => {
  await preview({ ...candidate, photo: { provider: 'google', url } })
  expect(mockGet).not.toHaveBeenCalled()
})

it.each(['denied', 'failed', 'empty'])('omits unavailable candidate photos (%s) while allowing submission', async status => {
  if (status === 'failed') mockGet.mockRejectedValue(new Error('offline'))
  else mockGet.mockResolvedValue({ status, photos: [] })
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  await act(async () => {})
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
  await completeWizard()
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ googlePlaceId: 'ChIJtest', enrichment: expect.any(Object) }))
})

it.each(['Giá cao nhất (VND)', 'Món ngon phải thử & Mẹo khi ghé'])(
  'scrolls the focused %s and its helper above a resized keyboard viewport and dismisses outside',
  async label => {
    let keyboard: (() => void) | undefined
    const addListener = Keyboard.addListener.bind(Keyboard)
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
      if (name === 'keyboardDidShow') keyboard = listener as () => void
      return addListener(name, listener)
    })
    const scroll = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
    jest.spyOn(View.prototype, 'measureLayout').mockImplementation((_relative, callback) => callback(0, 700, 350, 150))
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {})
    jest.useFakeTimers()
    await preview()
    if (label.startsWith('Giá')) await fireEvent.press(screen.getByRole('button', { name: 'Trên 200k / người' }))
    else await completeWizard()
    await fireEvent(screen.getByTestId('import-scroll'), 'layout', { nativeEvent: { layout: { height: 400 } } })
    const input = screen.getByLabelText(label)
    await fireEvent(input, 'focus', {})
    await act(async () => {
      keyboard?.()
      jest.runOnlyPendingTimers()
    })
    // Group bottom (including helper) 850 + 16 clearance, visible height 400.
    expect(scroll).toHaveBeenLastCalledWith({ y: 466, animated: false })
    expect(StyleSheet.flatten(screen.getByTestId('import-keyboard-avoider').props.style)).toMatchObject({ flex: 1 })
    expect(StyleSheet.flatten(screen.getByTestId('import-header').props.style).backgroundColor).toBeTruthy()
    await fireEvent.press(screen.getByTestId('import-dismiss-keyboard'))
    expect(dismiss).toHaveBeenCalled()
    await fireEvent(input, 'blur', {})
    scroll.mockClear()
    await act(async () => {
      keyboard?.()
      jest.runOnlyPendingTimers()
    })
    expect(scroll).not.toHaveBeenCalled()
  },
)

it('drops a late candidate photo response after the link changes', async () => {
  let finish: (response: unknown) => void = () => {}
  mockGet.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve
      }),
  )
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  const signal = mockGet.mock.calls[0][1].signal as AbortSignal
  await fireEvent.press(screen.getByRole('button', { name: 'Đổi link' }))
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK + '&new=1')
  expect(signal.aborted).toBe(true)
  await act(async () => {
    finish({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'bGF0ZQ==', authorAttributions: [] }] })
  })
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
})

it('hides a failed candidate image and its credits without placeholder art', async () => {
  mockGet.mockResolvedValue({
    status: 'ok',
    attribution: 'Google Maps',
    photos: [{ contentType: 'image/jpeg', dataBase64: 'YmFk', authorAttributions: [{ displayName: 'Lan' }] }],
  })
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  await waitFor(() => expect(screen.getByTestId('import-candidate-photo')).toBeTruthy())
  await fireEvent(screen.getByTestId('import-candidate-photo'), 'error', { nativeEvent: { error: 'decode failed' } })
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
  expect(screen.queryByText('Ảnh: Lan · Google Maps')).toBeNull()
  expect(screen.queryByTestId('place-photo-placeholder')).toBeNull()
})

it('shows photo loading without blocking submit, then removes the image slot when the BFF has no photo', async () => {
  let finish: (response: unknown) => void = () => {}
  mockGet.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  expect(screen.getByTestId('import-candidate-photo-loading').props.accessibilityRole).toBe('progressbar')
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
  await completeWizard()
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ googlePlaceId: 'ChIJtest', enrichment: expect.any(Object) }))
  await act(async () => { finish({ status: 'unavailable', photos: [] }) })
  expect(screen.queryByTestId('import-candidate-photo-loading')).toBeNull()
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
  expect(screen.queryByTestId('place-photo-placeholder')).toBeNull()
})

it('renders only the first Google photo with its own response credits', async () => {
  mockGet.mockResolvedValue({
    status: 'ok', attribution: 'Google Maps',
    photos: [
      { contentType: 'image/jpeg', dataBase64: 'Zmlyc3Q=', authorAttributions: [{ displayName: 'First author' }] },
      { contentType: 'image/png', dataBase64: 'c2Vjb25k', authorAttributions: [{ displayName: 'Second author' }] },
    ],
  })
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest', attribution: 'Outdated credit' } })
  await waitFor(() => expect(screen.getAllByTestId('import-candidate-photo')).toHaveLength(1))
  expect(screen.getByText('Ảnh: First author · Google Maps')).toBeTruthy()
  expect(screen.queryByText(/Second author|Outdated credit/)).toBeNull()
  expect(mockGet).toHaveBeenCalledTimes(1)
})

it.each([{ authorAttributions: [] }, { authorAttributions: [{ displayName: '' }] }])('omits a photo without usable author attribution (%j)', async ({ authorAttributions }) => {
  mockGet.mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions }] })
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  await act(async () => {})
  expect(screen.queryByTestId('import-candidate-photo-loading')).toBeNull()
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
})

it('does not buy a Google photo for an existing GoGo place even if a candidate reference is present', async () => {
  mockResolve.data = { status: 'ALREADY_EXISTS', existingPlaceId: 'canonical', candidate: { ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } } }
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  expect(screen.getByText('Existing')).toBeTruthy()
  expect(mockGet).not.toHaveBeenCalled()
})


it('keeps verification loading inside the same disabled button and preserves the link controls', async () => {
  mockResolve.isPending = true
  await renderScreen(<PlaceImportScreen />)
  const button = screen.getByRole('button', { name: 'Đang kết nối Google Maps...' })
  expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true })
  expect(screen.getByTestId('button-spinner')).toBeTruthy()
  expect(screen.getByTestId('import-link-input').props.multiline).toBe(false)
  expect(screen.getByRole('button', { name: 'Dán link' })).toBeTruthy()
})

it('uses the directly downloaded Stitch photo/body hierarchy with real hours and sourced rating', async () => {
  mockGet.mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions: [{ displayName: 'Lan' }] }] })
  await preview({ ...candidate, address: 'Real street', googleRating: 4.8, googleRatingCount: 123,
    openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openMinute: 450, closeMinute: 1350, isOvernight: false })),
    photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  await waitFor(() => expect(screen.getByTestId('import-candidate-photo')).toBeTruthy())
  expect(StyleSheet.flatten(screen.getByTestId('import-preview-photo-frame').props.style)).toMatchObject({ aspectRatio: 1.6 })
  expect(StyleSheet.flatten(screen.getByTestId('import-preview-card').props.style)).toMatchObject({ borderRadius: 12, overflow: 'hidden' })
  expect(screen.getByText('Dữ liệu đã trích xuất')).toBeTruthy()
  expect(screen.queryByText('✓ Dữ liệu Google Maps xác thực')).toBeNull()
  expect(screen.queryByText('✓ Đã đồng bộ từ Google Maps')).toBeNull()
  expect(screen.getAllByTestId('import-verified-confirmation')).toHaveLength(1)
  expect(screen.getByText('Đã đồng bộ')).toBeTruthy()
  expect(screen.getByText('Đang mở · 07:30–22:30 hàng ngày')).toBeTruthy()
  expect(screen.getByText('(123) Google')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull()
  expect(within(screen.getByTestId('import-preview-card')).queryByText(/Chỉ lưu được sau khi|\+50/)).toBeNull()
  expect(screen.queryByText(/Chỉ lưu được sau khi/)).toBeNull()
  expect(screen.queryByText('Mơ Concept & Roastery')).toBeNull()
})


it('renders the empty Stitch input and working paste without seeding a sample link', async () => {
  await renderScreen(<PlaceImportScreen />)
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  expect(screen.getByRole('button', { name: 'Tiếp tục trích xuất thông tin' }).props.accessibilityState.disabled).toBe(true)
  expect(screen.queryByText('Định dạng hợp lệ • Sẵn sàng đồng bộ')).toBeNull()
  expect(screen.getByText('3 bước lấy link nhanh')).toBeTruthy()
  expect(screen.queryByText(/70 Credit|20 Credit|Mơ Concept/)).toBeNull()
  mockClipboard.mockResolvedValue('  ' + LINK + '  ')
  await fireEvent.press(screen.getByRole('button', { name: 'Dán link' }))
  expect(screen.getByTestId('import-link-input').props.value).toBe(LINK)
  expect(screen.getByText('Định dạng hợp lệ • Sẵn sàng đồng bộ')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục trích xuất thông tin' }))
  expect(mockResolve.mutate).toHaveBeenCalledWith({ url: LINK }, expect.any(Object))
})

it.each(['not a URL', 'https://maps.app.goo.gl.evil.test/place', 'https://mail.google.com/inbox', 'javascript://maps.app.goo.gl/place'])('flags invalid typing and never resolves %s', async value => {
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), value)
  expect(screen.getByText('Vui lòng kiểm tra lại liên kết Google Maps')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục trích xuất thông tin' }))
  expect(mockResolve.mutate).not.toHaveBeenCalled()
})

it('handles unavailable and empty clipboard without supplying a sample', async () => {
  await renderScreen(<PlaceImportScreen />)
  mockClipboard.mockRejectedValueOnce(new Error('denied'))
  await fireEvent.press(screen.getByRole('button', { name: 'Dán link' }))
  expect(screen.getByText('Không đọc hoặc mở được liên kết. Vui lòng thử lại hoặc nhập link trực tiếp.')).toBeTruthy()
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  mockClipboard.mockResolvedValueOnce(' ')
  await fireEvent.press(screen.getByRole('button', { name: 'Dán link' }))
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  expect(mockResolve.mutate).not.toHaveBeenCalled()
})

it('does not overwrite an edit with a late clipboard read', async () => {
  let finish: (value: string) => void = () => {}
  mockClipboard.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Dán link' }))
  await fireEvent.changeText(screen.getByTestId('import-link-input'), 'new input')
  await act(async () => { finish(LINK) })
  expect(screen.getByTestId('import-link-input').props.value).toBe('new input')
})

it('blocks verification offline and recovers on reconnect without losing the input', async () => {
  onlineManager.setOnline(false)
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  expect(screen.getByText('Bạn đang ngoại tuyến. Kết nối mạng để xác minh địa điểm.')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục trích xuất thông tin' }))
  expect(mockResolve.mutate).not.toHaveBeenCalled()
  await act(async () => { onlineManager.setOnline(true) })
  expect(screen.getByTestId('import-link-input').props.value).toBe(LINK)
  expect(screen.queryByText('Bạn đang ngoại tuyến. Kết nối mạng để xác minh địa điểm.')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục trích xuất thông tin' }))
  expect(mockResolve.mutate).toHaveBeenCalledTimes(1)
})

it.each(['paused', 'network'])('explains %s as offline instead of rejecting the place', async state => {
  mockResolve.isPaused = state === 'paused'
  mockResolve.isPending = state === 'paused'
  mockResolve.isError = state === 'network'
  mockResolve.error = new NetworkError()
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  expect(screen.getByText('Bạn đang ngoại tuyến. Kết nối mạng để xác minh địa điểm.')).toBeTruthy()
  expect(screen.queryByText('Không thể thêm địa điểm này')).toBeNull()
  expect(screen.queryByTestId('button-spinner')).toBeNull()
  expect(screen.getByRole('button', { name: 'Tiếp tục trích xuất thông tin' }).props.accessibilityState.disabled).toBe(state === 'paused')
})

it('retries a server error with the original URL', async () => {
  mockResolve.isError = true
  mockResolve.error = new ApiError(500, { code: 'ERROR', message: 'error' })
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(mockResolve.mutate).toHaveBeenCalledWith({ url: LINK }, expect.any(Object))
  expect(screen.getByTestId('import-link-input').props.value).toBe(LINK)
})

it('shows the post-verify header and actual synced URL with the three-step wizard', async () => {
  await preview()
  expect(screen.getByTestId('import-synced-link')).toBeTruthy()
  expect(screen.queryByText('Đã kết nối Google Maps')).toBeNull()
  expect(screen.getByText('Hoàn thiện hồ sơ địa điểm')).toBeTruthy()
  expect(screen.getByText(LINK.replace('https://', ''))).toBeTruthy()
  expect(screen.getByText('Preview • Đã xác minh vị trí')).toBeTruthy()
  expect(screen.queryByTestId('import-link-input')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Tiếp tục trích xuất thông tin' })).toBeNull()
  expect(screen.getByTestId('contribution-wizard')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeTruthy()
})

it('reveals the input and validation helper above the keyboard', async () => {
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  jest.spyOn(View.prototype, 'measureLayout').mockImplementation((_relative, callback) => callback(0, 700, 350, 150))
  jest.useFakeTimers()
  await renderScreen(<PlaceImportScreen />)
  await fireEvent(screen.getByTestId('import-scroll'), 'layout', { nativeEvent: { layout: { height: 400 } } })
  await fireEvent(screen.getByTestId('import-link-input'), 'focus', {})
  await act(async () => { jest.runOnlyPendingTimers() })
  expect(scroll).toHaveBeenLastCalledWith({ y: 466, animated: false })
})


it.each(['input', 'verified'] as const)('uses the shared notification bell in the %s header without share/avatar', async (state) => {
  mockUnread.count = 2
  if (state === 'verified') await preview()
  else await renderScreen(<PlaceImportScreen />)
  expect(screen.queryByRole('button', { name: 'Chia sẻ' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Cá nhân' })).toBeNull()
  expect(screen.getByTestId('import-unread-dot')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('import-bell'))
  expect(mockRouter.push).toHaveBeenCalledWith('/notifications')
  await fireEvent.press(within(screen.getByTestId('import-header')).getByRole('button', { name: 'Quay lại' }))
  if (state === 'verified') expect(screen.getByTestId('import-link-input').props.value).toBe('')
  else expect(mockRouter.back).toHaveBeenCalledTimes(1)
})

it('omits the notification dot when the inbox has no unread items', async () => {
  await preview()
  expect(screen.getByRole('button', { name: 'Thông báo' })).toBeTruthy()
  expect(screen.queryByTestId('import-unread-dot')).toBeNull()
})

it('keeps link-taking help and hides footer links until contributions has a route', async () => {
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Hướng dẫn trợ giúp' }))
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ animated: true }))
  expect(screen.queryByText('Cách tính điểm GoGo Credit')).toBeNull()
  expect(screen.queryByText('Xem địa điểm đã đóng góp')).toBeNull()
  expect(screen.queryByText('Danh sách đóng góp chưa khả dụng.')).toBeNull()
})


it('keeps a long clipboard URL in a fixed single-line scrolling input with clear x', async () => {
  const longLink = LINK + '&query=' + 'KemTrangTien'.repeat(100)
  mockClipboard.mockResolvedValue(longLink)
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Dán link' }))
  const input = screen.getByTestId('import-link-input')
  expect(input.props).toMatchObject({ value: longLink, multiline: false, numberOfLines: 1, scrollEnabled: true })
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({ height: 52, width: '100%', minWidth: 0, flexShrink: 1, paddingRight: 48 })
  await fireEvent.press(screen.getByRole('button', { name: 'Xóa liên kết' }))
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
})

it('keeps the owner Maps URL on one centred line across paste, focus and blur', async () => {
  const url = 'https://maps.app.goo.gl/nibnZC3FQLTtmBxM7'
  mockClipboard.mockResolvedValue(url)
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Dán link' }))
  const input = screen.getByTestId('import-link-input')
  expect(input.props).toMatchObject({ value: url, multiline: false, numberOfLines: 1, scrollEnabled: true })
  const inputStyle = StyleSheet.flatten(input.props.style)
  // A fixed lineHeight creates an iOS paragraph style with word wrapping,
  // even on UITextField. Let the native single-line editor use font metrics.
  expect(inputStyle.lineHeight).toBeUndefined()
  expect(inputStyle).toMatchObject({ height: 52, paddingVertical: 0, textAlignVertical: 'center' })
  const expectTruncatedDisplay = () => {
    const displays = screen.getAllByText(url, { includeHiddenElements: true })
    for (const display of displays) {
      expect(display.props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' })
    }
    expect(StyleSheet.flatten(screen.getByTestId('import-link-display', { includeHiddenElements: true }).props.style)).toMatchObject({
      top: 0, bottom: 0, left: 40, right: 48, justifyContent: 'center',
    })
  }
  expectTruncatedDisplay()
  await fireEvent(input, 'focus', {})
  expect(screen.queryByTestId('import-link-display', { includeHiddenElements: true })).toBeNull()
  expect(screen.queryByText(url, { includeHiddenElements: true })).toBeNull()
  expect(StyleSheet.flatten(screen.getByTestId('import-link-input').props.style).color).not.toBe('transparent')
  await fireEvent(input, 'blur', {})
  expectTruncatedDisplay()
  await fireEvent.press(screen.getByRole('button', { name: 'Xóa liên kết' }))
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  expect(screen.queryByTestId('import-link-display', { includeHiddenElements: true })).toBeNull()
})

it.each(['https://www.google.com/maps/contrib/123', '//maps.google.com/maps/contrib/123'])('combines photo authors and Google Maps once, preserving profile link %s and distinct credits', async (uri) => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  mockGet.mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions: [{ displayName: 'Lan', uri }, { displayName: 'Minh' }] }] })
  await preview({ ...candidate, attributions: ['Google Maps', 'Other credit'], photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  await waitFor(() => expect(screen.getByTestId('import-photo-credit')).toBeTruthy())
  const frame = within(screen.getByTestId('import-preview-photo-frame'))
  expect(frame.getByText('Ảnh: Lan, Minh · Google Maps')).toBeTruthy()
  expect(screen.getAllByTestId('import-photo-credit')).toHaveLength(1)
  expect(StyleSheet.flatten(frame.getByTestId('import-photo-credit').props.style)).toMatchObject({
    borderRadius: 999, maxWidth: '100%', flexShrink: 1, color: themes.orange.redesign.white, backgroundColor: themes.orange.redesign.scrimStart,
  })
  expect(screen.queryByText('Google Maps')).toBeNull()
  expect(screen.getByText('Other credit')).toBeTruthy()
  await fireEvent.press(screen.getByRole('link', { name: 'Lan' }))
  expect(open).toHaveBeenCalledWith(uri.startsWith('//') ? `https:${uri}` : uri)
})


it.each([false, true])('puts the Maps icon inside the candidate card (photo: %s), without save or repeated credit', async hasPhoto => {
  const uri = 'https://www.google.com/maps?cid=123'
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  mockGet.mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions: [{ displayName: 'Lan' }] }] })
  await preview({ ...candidate, googleMapsUri: uri, ...(hasPhoto ? { photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } } : {}) })
  if (hasPhoto) await waitFor(() => expect(screen.getByTestId('import-candidate-photo')).toBeTruthy())
  const card = screen.getByTestId('import-preview-card')
  const maps = within(card).getByRole('button', { name: 'Mở trên Google Maps' })
  expect(StyleSheet.flatten(maps.props.style)).toMatchObject({ width: 44, height: 44 })
  expect(screen.getAllByRole('button', { name: 'Mở trên Google Maps' })).toHaveLength(1)
  expect(screen.queryByText('Mở trên Google Maps')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull()
  expect(within(screen.getByTestId('import-preview-card')).queryByText(/Chỉ lưu được sau khi|\+50/)).toBeNull()
  expect(screen.queryByText(/Chỉ lưu được sau khi/)).toBeNull()
  await fireEvent.press(maps)
  expect(open).toHaveBeenCalledWith(uri)
})

it('omits the Maps action when the candidate has no URI', async () => {
  await preview()
  expect(screen.queryByRole('button', { name: 'Mở trên Google Maps' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull()
  expect(within(screen.getByTestId('import-preview-card')).queryByText(/Chỉ lưu được sau khi|\+50/)).toBeNull()
  expect(screen.queryByText(/Chỉ lưu được sau khi/)).toBeNull()
})

it('shows the existing link failure message when the card Maps action fails', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unavailable'))
  await preview({ ...candidate, googleMapsUri: LINK })
  await fireEvent.press(screen.getByRole('button', { name: 'Mở trên Google Maps' }))
  expect(screen.getByText('Chưa mở được liên kết này.')).toBeTruthy()
})

it('keeps canonical saving available for an existing GoGo place', async () => {
  mockResolve.data = { status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' }
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  const save = screen.getByRole('button', { name: 'Lưu' })
  expect(save.props.accessibilityState.disabled).toBe(false)
  await fireEvent.press(save)
  expect(mockToggleSaved).toHaveBeenCalledWith({ type: 'place', id: 'canonical', saved: false })
})

// Structural proof; native truncation still needs simulator confirmation.
it.each(['orange', 'orangeDark'] as const)('bounds a single-line top-left credit away from Maps and removes photo hours (%s)', async themeName => {
  const create = jest.spyOn(UnistylesStyleSheet, 'create')
  jest.isolateModules(() => { jest.requireActual('@/shared/ui/place-card.style') })
  const factory = create.mock.calls[0][0] as (theme: AppTheme) => Record<string, any>
  const styles = factory(themes[themeName])
  create.mockRestore()
  expect(styles.importPhotoOverlays).toMatchObject({ position: 'absolute', top: 12, left: 12, right: 60, alignItems: 'flex-start' })
  expect(styles.importPhotoOverlays.bottom).toBeUndefined()
  expect(styles.importHeaderAction).toMatchObject({ top: 8, right: 8 })
  // Right edge is 60pt from frame edge; Maps occupies 8 + 44pt, leaving 8pt.
  expect(styles.importPhotoOverlays.right - (styles.importHeaderAction.right + 44)).toBeGreaterThanOrEqual(8)
  expect(styles.importPhotoCredit).toMatchObject({ maxWidth: '100%', borderRadius: 999, backgroundColor: themes[themeName].redesign.scrimStart })
  mockGet.mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions: [{ displayName: 'A very long photographer name '.repeat(20) }] }] })
  await preview({ ...candidate, googleMapsUri: LINK, openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openMinute: 0, closeMinute: 1440 })), photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  await waitFor(() => expect(screen.getByTestId('import-photo-credit')).toBeTruthy())
  const row = within(screen.getByTestId('import-photo-overlays'))
  expect(row.getByTestId('import-photo-credit').props).toMatchObject({
    numberOfLines: 1, ellipsizeMode: 'tail',
    accessibilityLabel: `Ảnh: ${'A very long photographer name '.repeat(20).trim()} · Google Maps`,
  })
  expect(row.queryByTestId('import-photo-hours')).toBeNull()
  expect(screen.getAllByTestId('import-body-hours')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Mở trên Google Maps' })).toBeTruthy()
  await fireEvent(screen.getByTestId('import-candidate-photo'), 'error', { nativeEvent: { error: 'decode failed' } })
  expect(screen.queryByTestId('import-photo-credit')).toBeNull()
})


it.each([
  ['2026-11-07T05:00:00Z', 'Đang mở · 08:00–23:00 hàng ngày', true],
  ['2026-11-07T00:00:00Z', 'Đã đóng · Mở 08:00', false],
  ['2026-11-07T16:30:00Z', 'Đã đóng · Mở 08:00 ngày mai', false],
] as const)('renders API hours once in the body across extracted and supplement stages (%s)', async (now, label, isOpen) => {
  mockNow.value = new Date(now)
  mockGet.mockResolvedValue({ status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions: [{ displayName: 'Lan' }] }] })
  await preview({ ...candidate,
    openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openMinute: 480, closeMinute: 1380 })),
    photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' },
  })
  await waitFor(() => expect(screen.getByTestId('import-candidate-photo')).toBeTruthy())
  const checkHours = () => {
    expect(screen.getAllByText(label)).toHaveLength(1)
    expect(screen.getAllByTestId('import-body-hours')).toHaveLength(1)
    expect(within(screen.getByTestId('import-preview-photo-frame')).queryByText(/08:00|23:00|Đang mở|Đã đóng/)).toBeNull()
    expect(screen.queryByTestId('import-photo-hours')).toBeNull()
    expect(StyleSheet.flatten(within(screen.getByTestId('import-body-hours')).getByText('●').props.style).color)
      .toBe(isOpen ? themes.orange.status.successText : themes.orange.status.dangerText)
  }
  checkHours()
  await completeWizard()
  checkHours()
})

it('omits unknown opening facts rather than inventing a state or schedule', async () => {
  await preview()
  expect(screen.queryByTestId('import-body-hours')).toBeNull()
  expect(screen.queryByTestId('import-photo-hours')).toBeNull()
})

it('requires the wizard after branch selection and clears another branch’s contribution', async () => {
  mockResolve.data = { status: 'CANDIDATE_SELECTION', candidates: [
    { googlePlaceId: 'ChIJbranchA', name: 'Branch A', address: 'A' },
    { googlePlaceId: 'ChIJbranchB', name: 'Branch B', address: 'B' },
  ] }
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  expect(screen.queryByTestId('contribution-wizard')).toBeNull()
  await fireEvent.press(screen.getByText('Branch A'))
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).not.toHaveBeenCalled()
  await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé'), 'A only')
  await fireEvent.press(screen.getByText('Branch B'))
  expect(screen.getByText('Tiếp tục sang Bước 2')).toBeTruthy()
  await completeWizard()
  expect(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé').props.value).toBe('')
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ googlePlaceId: 'ChIJbranchB', enrichment: expect.not.objectContaining({ visitTips: expect.anything() }) }))
})
