import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { renderScreen } from './harness'

const mockResolve = { data: undefined as unknown, mutate: jest.fn(), reset: jest.fn(), isPending: false }
const mockSubmit = { mutateAsync: jest.fn(), reset: jest.fn() }
const mockPick = jest.fn()
const mockPermission = jest.fn()
const mockGet = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockPermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockPick(...args),
}))
jest.mock('@/shared/api/client', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => mockResolve,
  useSubmitPlace: () => mockSubmit,
  usePlaceSubmission: () => ({}),
  useTaxonomies: () => ({}),
  usePlaceDetail: () => ({ data: { id: 'canonical', name: 'Existing' } }),
  useSaved: () => ({ data: [] }),
  useToggleSaved: () => ({}),
}))
import PlaceImportScreen from '@/features/place-import/import.view'
const LINK = 'https://maps.google.com/maps?place_id=ChIJtest'
const candidate = { googlePlaceId: 'ChIJtest', name: 'Preview' }
async function preview(value: unknown = candidate) {
  mockResolve.data = { status: 'RESOLVED', candidate: value }
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Xác minh địa điểm'))
}
beforeEach(() => {
  jest.clearAllMocks()
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

it('keeps a long URL single-line and clears the input, preview and metadata with a 44pt accessible control', async () => {
  await preview()
  await fireEvent.press(screen.getByText('Bổ sung thông tin'))
  await fireEvent.changeText(screen.getByPlaceholderText('Ghi chú cho người kiểm duyệt…'), 'old note')
  const input = screen.getByTestId('import-link-input')
  expect(input.props.multiline).toBe(false)
  expect(input.props.numberOfLines).toBe(1)
  const clear = screen.getByRole('button', { name: 'Xóa liên kết' })
  expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ width: 44, height: 44 })
  await fireEvent.press(clear)
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  expect(screen.queryByText('Preview')).toBeNull()
  expect(screen.queryByLabelText('Xóa liên kết')).toBeNull()
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK + '&long=' + 'a'.repeat(400))
  expect(screen.getByTestId('import-link-input').props.multiline).toBe(false)
})

it('spaces the card/actions and individual buttons, and removes the lone entered-link control', async () => {
  mockResolve.data = { status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' }
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Xác minh địa điểm'))
  expect(StyleSheet.flatten(screen.getByTestId('import-result-actions').props.style)).toMatchObject({ marginTop: 16, gap: 12 })
  expect(screen.queryByText('Liên kết đã nhập')).toBeNull()
})

it('picks up to five optional photos, removes one, and never uploads or attaches local URIs on submit', async () => {
  await preview()
  mockPick.mockResolvedValueOnce({ canceled: false, assets: Array.from({ length: 7 }, (_, i) => ({ uri: `file:///${i}.jpg` })) })
  await fireEvent.press(screen.getByText('Thêm ảnh'))
  expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 5, mediaTypes: ['images'] }))
  expect(screen.getAllByTestId('import-local-photo')).toHaveLength(5)
  expect(screen.getByRole('button', { name: 'Thêm ảnh' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(screen.getByRole('button', { name: 'Xóa ảnh 1' }))
  expect(screen.getAllByTestId('import-local-photo')).toHaveLength(4)
  await fireEvent.press(screen.getByText('Thêm ảnh'))
  expect(mockPick).toHaveBeenLastCalledWith(expect.objectContaining({ selectionLimit: 1 }))
  expect(screen.getByText('Ảnh chỉ xem trước trên thiết bị, chưa được gửi cùng địa điểm.')).toBeTruthy()
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith({ googlePlaceId: 'ChIJtest' })
  expect(mockGet).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByLabelText('Xóa liên kết'))
  expect(screen.queryAllByTestId('import-local-photo')).toHaveLength(0)
})

it.each(['denied', 'canceled', 'error'])('handles photo picker %s without requiring a photo', async outcome => {
  await preview()
  if (outcome === 'denied') mockPermission.mockResolvedValue({ granted: false })
  if (outcome === 'canceled') mockPick.mockResolvedValue({ canceled: true, assets: [] })
  if (outcome === 'error') mockPick.mockRejectedValue(new Error('library unavailable'))
  await fireEvent.press(screen.getByText('Thêm ảnh'))
  expect(screen.queryAllByTestId('import-local-photo')).toHaveLength(0)
  if (outcome === 'denied') expect(mockPick).not.toHaveBeenCalled()
  if (outcome !== 'canceled')
    expect(
      screen.getByText(
        outcome === 'denied'
          ? 'Cho phép truy cập thư viện để chọn ảnh. Bạn vẫn có thể gửi địa điểm không kèm ảnh.'
          : 'Không mở được thư viện ảnh. Vui lòng thử lại.',
      ),
    ).toBeTruthy()
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith({ googlePlaceId: 'ChIJtest' })
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
  expect(screen.getByText('Google Maps · Lan')).toBeTruthy()
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
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith({ googlePlaceId: 'ChIJtest' })
})

it.each(['Từ', 'Đến', 'Ghi chú cho người kiểm duyệt…'])(
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
    await fireEvent.press(screen.getByText('Bổ sung thông tin'))
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
  expect(screen.queryByText('Google Maps · Lan')).toBeNull()
  expect(screen.queryByTestId('place-photo-placeholder')).toBeNull()
})

it('does not restore local photos from a picker finishing after the link was cleared', async () => {
  let finish: (response: unknown) => void = () => {}
  mockPick.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve
      }),
  )
  await preview()
  await fireEvent.press(screen.getByText('Thêm ảnh'))
  await fireEvent.press(screen.getByLabelText('Xóa liên kết'))
  await act(async () => {
    finish({ canceled: false, assets: [{ uri: 'file:///old.jpg' }] })
  })
  expect(screen.queryAllByTestId('import-local-photo')).toHaveLength(0)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Xác minh địa điểm'))
  expect(screen.queryAllByTestId('import-local-photo')).toHaveLength(0)
})

it('shows photo loading without blocking submit, then removes the image slot when the BFF has no photo', async () => {
  let finish: (response: unknown) => void = () => {}
  mockGet.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await preview({ ...candidate, photo: { provider: 'google', url: '/v1/places/google-provider-photo/ChIJtest' } })
  expect(screen.getByTestId('import-candidate-photo-loading').props.accessibilityRole).toBe('progressbar')
  expect(screen.queryByTestId('import-candidate-photo')).toBeNull()
  await fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith({ googlePlaceId: 'ChIJtest' })
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
  expect(screen.getByText('Google Maps · First author')).toBeTruthy()
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
  await fireEvent.press(screen.getByText('Xác minh địa điểm'))
  expect(screen.getByText('Existing')).toBeTruthy()
  expect(mockGet).not.toHaveBeenCalled()
})


it('keeps verification loading inside the same disabled button and preserves the link controls', async () => {
  mockResolve.isPending = true
  await renderScreen(<PlaceImportScreen />)
  const button = screen.getByRole('button', { name: 'Đang xác minh trên Google Maps…' })
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
  expect(screen.getByText('✓ Dữ liệu Google Maps xác thực')).toBeTruthy()
  expect(screen.getByText('07:30 - 22:30 hàng ngày')).toBeTruthy()
  expect(screen.getByText('(123) Google')).toBeTruthy()
  const save = screen.getByRole('button', { name: 'Lưu' })
  expect(save.props.accessibilityState.disabled).toBe(true)
  expect(save.props.accessibilityHint).toBe('Chỉ lưu được sau khi địa điểm được duyệt và có trên GoGo.')
  expect(screen.queryByText('Mơ Concept & Roastery')).toBeNull()
})
