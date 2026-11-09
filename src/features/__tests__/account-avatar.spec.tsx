jest.mock('@/shared/administrative/queries', () => ({ useAdministrativeVersion: () => ({ data: { datasetVersion: 'v1' } }) }))
jest.mock('@/shared/administrative/administrative-picker.view', () => ({ AdministrativePicker: () => null }))
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'

import { loaded, renderScreen, type QueryLike } from './harness'
import { scriptedTime } from './scripted-time'
import { AccessibilityInfo, BackHandler, Linking, StyleSheet } from 'react-native'
import { themes } from '@/shared/ui/theme'
import i18n from '@/shared/i18n'
import { pressAndHold } from '@/shared/ui/__tests__/press-and-hold'

/**
 * PROF-APP-002 (#177), ADR-0022 — the avatar control on the account screen.
 * Disabled with the reason before a picker opens when the environment cannot
 * take a picture; otherwise pick → upload → attach, with the server's answer as
 * the only picture ever shown as saved, and one sentence per failure.
 *
 * Every binding a jest.mock factory touches must be `mock`-prefixed; the
 * factories are hoisted above the imports.
 */

const mockMe: { query: QueryLike } = { query: loaded(null) }
// The defaults card below the avatar reads reference data; empty lists keep it
// out of the way of these cases (it has its own spec).
const mockRefData = { areas: loaded({ areas: [] }), taxonomies: loaded({ kinds: {} }) }
const mockUpload = jest.fn()
const mockSetAvatar = jest.fn()
const mockRemoveAvatar = jest.fn()
const mockPick = jest.fn()
const mockDelete = jest.fn()
const mockSetOptions = jest.fn()
const mockNavigation = { setOptions: mockSetOptions }

jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', deleteAccount: mockDelete }),
}))

jest.mock('@/shared/media/pick-avatar', () => ({
  selectAvatar: (source: string) => mockPick(source),
  cropAvatar: jest.fn(async () => ({ uri: 'file:///a.jpg', mimeType: 'image/jpeg' })),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockMe.query,
  useUpdateProfile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateDateOfBirth: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUploadImage: () => ({ mutateAsync: mockUpload }),
  useSetAvatar: () => ({ mutateAsync: mockSetAvatar }),
  useRemoveAvatar: () => ({ mutateAsync: mockRemoveAvatar }),
  useServiceAreas: () => mockRefData.areas,
  useTaxonomies: () => mockRefData.taxonomies,
  exportMyData: jest.fn(),
}))

import { ApiError } from '@/shared/api'
import AccountScreen from '@/features/account/account.view'

function profile(overrides: Record<string, unknown> = {}) {
  return {
    actorType: 'user',
    id: 'u1',
    displayName: 'An',
    email: 'an@gogo.id.vn',
    locale: 'vi',
    avatarUrl: null,
    homeArea: null,
    interests: { mood: [] },
    usualBudget: null,
    capabilities: { avatarUpload: 'available' },
    ...overrides,
  }
}

function expectInScreenEditor(view: Awaited<ReturnType<typeof renderScreen>>) {
  let ancestor = view.getByText('Dùng ảnh này').parent
  while (ancestor) {
    expect(ancestor.type).not.toBe('Modal')
    ancestor = ancestor.parent
  }
  expect(view.queryByText(i18n.t('account.export'))).toBeNull()
}

// Source-sheet exit / onClosed uses the same timer-driven Sheet as birthday.
scriptedTime()

beforeEach(() => {
  mockMe.query = loaded(profile())
  mockUpload.mockReset()
  mockSetAvatar.mockReset()
  mockRemoveAvatar.mockReset()
  mockPick.mockReset()
  mockDelete.mockReset().mockResolvedValue(undefined)
  mockSetOptions.mockClear()
})


describe('account screen layout (#297)', () => {
  it('keeps the actual Account back and Save actions transparent while held', async () => {
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.changeText(view.getByLabelText(i18n.t('auth.displayName')), 'An Nguyen')
    for (const name of [i18n.t('common.back'), i18n.t('account.save')]) {
      const action = view.getByRole('button', { name })
      expect(action).toBeEnabled()
      const resting = StyleSheet.flatten(action.props.style)
      expect(resting.backgroundColor).toBeUndefined()
      await pressAndHold(action)
      expect(StyleSheet.flatten(action.props.style)).toEqual(resting)
    }
  })

  it('keeps theme and defaults on the separate approved G11 routes', async () => {
    const view = await renderScreen(<AccountScreen />)
    expect(view.queryByText('Màu chủ đề')).toBeNull()
    expect(view.queryByText('Mặc định khi tạo kèo')).toBeNull()
    expect(view.getByText('an@gogo.id.vn')).toBeTruthy()
    expect(view.getByText('Dữ liệu của bạn')).toBeTruthy()
  })
})

describe('account avatar', () => {
  it('is disabled with the reason before a picker opens when the environment cannot take one', async () => {
    mockMe.query = loaded(profile({ capabilities: { avatarUpload: 'unavailable' } }))
    const view = await renderScreen(<AccountScreen />)
    expect(view.getByText('Tải ảnh chưa khả dụng ở môi trường này.')).toBeTruthy()
    const change = view.getByLabelText('Đổi ảnh đại diện')
    await fireEvent.press(change)
    expect(mockPick).not.toHaveBeenCalled()
  })

  it('picks, uploads and attaches, with only an accessibility announcement as feedback', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///a.jpg', width: 800, height: 600 } })
    mockUpload.mockResolvedValue('tmp/avatars/u1/k.jpg')
    mockSetAvatar.mockResolvedValue(profile({ avatarUrl: 'https://assets-test.local/avatars/x.webp' }))
    const view = await renderScreen(<AccountScreen />)

    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    await fireEvent.press(await view.findByText('Dùng ảnh này'))

    expect(mockUpload).toHaveBeenCalledWith({
      image: { uri: 'file:///a.jpg', mimeType: 'image/jpeg' },
      purpose: 'avatar',
    })
    expect(mockSetAvatar).toHaveBeenCalledWith('tmp/avatars/u1/k.jpg')
    await waitFor(() => expect(view.queryByText('Dùng ảnh này')).toBeNull())
    expect(view.queryByText('✓ Đã cập nhật ảnh')).toBeNull()
    expect(view.queryByText(i18n.t('account.avatarSaved'))).toBeNull()
    expect(announce).toHaveBeenCalledWith(i18n.t('account.avatarSaved'))
    announce.mockRestore()
  })

  it('tells the person to pick another image when the server cannot read this one', async () => {
    mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///a.jpg', width: 800, height: 600 } })
    mockUpload.mockResolvedValue('tmp/avatars/u1/k.jpg')
    mockSetAvatar.mockRejectedValue(
      new ApiError(422, { code: 'AVATAR_UNPROCESSABLE', message: 'The image could not be read' }),
    )
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    await fireEvent.press(await view.findByText('Dùng ảnh này'))
    expect(await view.findByText('Ảnh không đọc được. Chọn ảnh khác nhé.')).toBeTruthy()
  })

  it('says the server is busy for a retryable refusal, and never shows a local preview as saved', async () => {
    mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///a.jpg', width: 800, height: 600 } })
    mockUpload.mockResolvedValue('tmp/avatars/u1/k.jpg')
    mockSetAvatar.mockRejectedValue(
      new ApiError(503, { code: 'AVATAR_BUSY', message: 'busy', retryable: true }),
    )
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    await fireEvent.press(await view.findByText('Dùng ảnh này'))
    expect(await view.findByText('Máy chủ đang bận. Thử lại sau ít phút.')).toBeTruthy()
    expect(view.queryByTestId('avatar-image')).toBeNull()
  })

  it('names the missing permission and uploads nothing', async () => {
    mockPick.mockResolvedValue({ status: 'denied' })
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    if (view.queryByText('Dùng ảnh này')) await fireEvent.press(view.getByText('Dùng ảnh này'))
    expect(await view.findByTestId('media-permission-sheet')).toBeTruthy()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('offers permission fallback without uploading when the library is unavailable', async () => {
    mockPick.mockResolvedValue({ status: 'unavailable' })
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    if (view.queryByText('Dùng ảnh này')) await fireEvent.press(view.getByText('Dùng ảnh này'))
    expect(await view.findByTestId('media-permission-sheet')).toBeTruthy()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('offers removal only when there is a picture, and removes on the server', async () => {
    const plain = await renderScreen(<AccountScreen />)
    await fireEvent.press(plain.getByLabelText('Đổi ảnh đại diện'))
    expect(plain.queryByText('Gỡ ảnh')).toBeNull()
    await plain.unmount()

    mockMe.query = loaded(profile({ avatarUrl: 'https://assets-test.local/avatars/x.webp' }))
    mockRemoveAvatar.mockResolvedValue(profile())
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Gỡ ảnh' }))
    await waitFor(() => expect(mockRemoveAvatar).toHaveBeenCalledTimes(1))
    expect(await view.findByText('✓ Đã gỡ ảnh')).toBeTruthy()
  })
})


it.each([['vi', 'Xác nhận'], ['en', 'Confirm']])('%s deletion confirmation keeps its warning and puts cancel left on one equal-width row', async (language, confirm) => {
  await act(async () => { await i18n.changeLanguage(language) })
  const view = await renderScreen(<AccountScreen />)
  const open = () => fireEvent.press(view.getByRole('button', { name: i18n.t('account.deleteConfirm') }))
  await open()
  expect(mockDelete).not.toHaveBeenCalled()
  const sheet = within(view.getByTestId('result-sheet'))
  const shortBody = language === 'vi'
    ? 'Không thể hoàn tác. Đánh giá và ảnh đã đóng góp vẫn được giữ ẩn danh.'
    : 'This cannot be undone. Contributed reviews and photos are kept anonymously.'
  expect(sheet.getByText(shortBody)).toBeTruthy()
  expect(sheet.queryByText(i18n.t('account.deleteBody'))).toBeNull()
  expect(sheet.queryByText(i18n.t('account.deleteKept'))).toBeNull()
  expect(view.getByText(i18n.t('account.deleteBody'))).toBeTruthy()
  expect(view.getByText(i18n.t('account.deleteKept'))).toBeTruthy()
  const left = sheet.getByRole('button', { name: i18n.t('account.deleteCancel') })
  const right = sheet.getByRole('button', { name: confirm })
  expect(left.parent).toBe(right.parent)
  expect(StyleSheet.flatten(left.parent!.props.style).flexDirection).toBe('row')
  expect(left.parent!.children.indexOf(left)).toBeLessThan(left.parent!.children.indexOf(right))
  for (const button of [left, right]) expect(StyleSheet.flatten(button.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
  expect(within(right).getByText(confirm).props.numberOfLines).toBe(1)
  await fireEvent.press(left)
  expect(mockDelete).not.toHaveBeenCalled()
  await open()
  await fireEvent.press(within(view.getByTestId('result-sheet')).getByRole('button', { name: confirm }))
  expect(mockDelete).toHaveBeenCalledTimes(1)
  await act(async () => { await i18n.changeLanguage('vi') })
})

it.each(['vi', 'en'])('%s opens localized source actions only on demand and cancels without selecting', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  const view = await renderScreen(<AccountScreen />)
  expect(view.queryByTestId('avatar-source-sheet')).toBeNull()
  await fireEvent.press(view.getByLabelText(i18n.t('account.avatarEdit')))
  const sheet = within(await view.findByTestId('avatar-source-sheet'))
  expect(sheet.getByRole('button', { name: i18n.t('account.avatarCamera') })).toBeTruthy()
  expect(sheet.getByRole('button', { name: i18n.t('account.avatarLibrary') })).toBeTruthy()
  expect(sheet.queryByRole('button', { name: i18n.t('account.avatarRemove') })).toBeNull()
  expect(mockPick).not.toHaveBeenCalled()
  await fireEvent.press(sheet.getByRole('button', { name: i18n.t('common.cancel') }))
  expect(mockPick).not.toHaveBeenCalled()
  expect(mockUpload).not.toHaveBeenCalled()
  await act(async () => { await i18n.changeLanguage('vi') })
})

it('defers upload until crop confirmation, preserves the old avatar on cancel, and can choose again', async () => {
  mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///draft.jpg', width: 800, height: 600 } })
  mockMe.query = loaded(profile({ avatarUrl: 'https://assets-test.local/old.webp' }))
  const view = await renderScreen(<AccountScreen />)
  await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
  await fireEvent.press(await view.findByRole('button', { name: 'Chụp ảnh' }))
  expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
  expect(mockPick).toHaveBeenCalledWith('camera')
  expect(mockUpload).not.toHaveBeenCalled()
  await fireEvent.press(view.getByRole('button', { name: 'Chọn ảnh khác' }))
  expect(await view.findByTestId('avatar-source-sheet')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: 'Chọn từ thư viện' }))
  expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: 'Đóng' }))
  expect(mockUpload).not.toHaveBeenCalled()
  expect(mockSetAvatar).not.toHaveBeenCalled()
  expect(view.getByTestId('avatar-image').props.source).toEqual([{ uri: 'https://assets-test.local/old.webp', cacheKey: 'https://assets-test.local/old.webp' }])
})

it.each(['camera', 'library'])('waits for %s completion before showing the in-screen editor on every selection', async source => {
  const view = await renderScreen(<AccountScreen />)
  await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
  for (let selection = 0; selection < 3; selection++) {
    let finishPicker!: (value: unknown) => void
    mockPick.mockImplementationOnce(() => new Promise(resolve => { finishPicker = resolve }))
    await fireEvent.press(await view.findByRole('button', { name: source === 'camera' ? 'Chụp ảnh' : 'Chọn từ thư viện' }))
    await waitFor(() => expect(mockPick).toHaveBeenCalledTimes(selection + 1))
    expect(view.queryByText('Dùng ảnh này')).toBeNull()
    expect(mockUpload).not.toHaveBeenCalled()
    await act(async () => {
      // Upstream may resolve while UIKit is still dismissing the picker.
      finishPicker({ status: 'selected', asset: { uri: 'file:///local.jpg', width: 800, height: 600 } })
    })
    expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
    expectInScreenEditor(view)
    await fireEvent.press(view.getByRole('button', { name: 'Chọn ảnh khác' }))
    expect(await view.findByTestId('avatar-source-sheet')).toBeTruthy()
  }
  expect(mockUpload).not.toHaveBeenCalled()
  expect(mockSetAvatar).not.toHaveBeenCalled()
})

it('handles fast repeated local selections without native presentation and resets the crop', async () => {
  mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///local.jpg', width: 800, height: 600 } })
  const view = await renderScreen(<AccountScreen />)
  await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
  for (let selection = 0; selection < 3; selection++) {
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
    expectInScreenEditor(view)
    expect(view.getByRole('adjustable').props.accessibilityValue.now).toBe(125)
    await fireEvent.press(view.getByRole('button', { name: i18n.t('account.avatarZoomIn') }))
    expect(view.getByRole('adjustable').props.accessibilityValue.now).toBe(140)
    await fireEvent.press(view.getByRole('button', { name: 'Chọn ảnh khác' }))
  }
  expect(mockPick).toHaveBeenCalledTimes(3)
  expect(mockUpload).not.toHaveBeenCalled()
})

it('uses the shared neutral export appearance on Account', async () => {
  const view = await renderScreen(<AccountScreen />)
  const button = view.getByRole('button', { name: i18n.t('account.export') })
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({
    backgroundColor: themes.orange.surface.subtle, borderWidth: 0,
  })
  expect(StyleSheet.flatten(view.getByText(i18n.t('account.export')).props.style).color).toBe(themes.orange.text.primary)
})

it('returns from the in-screen editor on Android back and preserves the account draft', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener')
  try {
    mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///local.jpg', width: 800, height: 600 } })
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.changeText(view.getByLabelText(i18n.t('auth.displayName')), 'Bình')
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false })
    const handler = back.mock.calls.at(-1)![1]
    await act(async () => { expect(handler()).toBe(true) })
    expect(view.queryByText('Dùng ảnh này')).toBeNull()
    expect(view.getByLabelText(i18n.t('auth.displayName')).props.value).toBe('Bình')
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
    expect(mockUpload).not.toHaveBeenCalled()
  } finally { back.mockRestore() }
})

it('consumes Android back while the confirmed avatar is uploading', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener')
  try {
    mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///local.jpg', width: 800, height: 600 } })
    let finishUpload!: (key: string) => void
    mockUpload.mockImplementation(() => new Promise(resolve => { finishUpload = resolve }))
    const view = await renderScreen(<AccountScreen />)
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: 'Chọn từ thư viện' }))
    await fireEvent.press(await view.findByText('Dùng ảnh này'))
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false })
    const handler = back.mock.calls.at(-1)![1]
    await act(async () => { expect(handler()).toBe(true) })
    expect(view.getByRole('button', { name: i18n.t('account.avatarUploading') })).toBeDisabled()
    await act(async () => { finishUpload('tmp/avatars/u1/k.jpg') })
    await waitFor(() => expect(view.queryByText('Dùng ảnh này')).toBeNull())
    expect(view.queryByText('✓ Đã cập nhật ảnh')).toBeNull()
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
  } finally { back.mockRestore() }
})

it('disables iOS stack swipe-back throughout editing and restores it on close, preserving the Account draft', async () => {
  mockPick.mockResolvedValue({ status: 'selected', asset: { uri: 'file:///local.jpg', width: 800, height: 600 } })
  const view = await renderScreen(<AccountScreen />)
  await fireEvent.changeText(view.getByLabelText(i18n.t('auth.displayName')), 'Bình')
  await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
  await fireEvent.press(await view.findByRole('button', { name: 'Chụp ảnh' }))
  expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
  expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false })
  await fireEvent.press(view.getByRole('button', { name: 'Đóng' }))
  expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true })
  expect(view.getByLabelText(i18n.t('auth.displayName')).props.value).toBe('Bình')
})

it.each([
  ['camera', 'denied'], ['camera', 'unavailable'], ['library', 'denied'], ['library', 'unavailable'],
] as const)('%s %s uses a permission sheet, with no inline Account permission block', async (source, status) => {
  mockPick.mockResolvedValue({ status })
  const view = await renderScreen(<AccountScreen />)
  await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
  await fireEvent.press(await view.findByRole('button', { name: i18n.t(source === 'camera' ? 'account.avatarCamera' : 'account.avatarLibrary') }))
  const root = await view.findByTestId('media-permission-sheet')
  const sheet = within(root)
  const title = i18n.t(`mediaPermission.${source}${status === 'denied' ? 'DeniedTitle' : 'UnavailableTitle'}`)
  expect(sheet.getByRole('header', { name: title })).toBeTruthy()
  expect(view.getAllByText(title)).toHaveLength(1)
  expect(sheet.getByRole('button', { name: i18n.t('common.cancel') })).toBeTruthy()
  expect(sheet.queryByRole('button', { name: i18n.t('account.avatarSettings') }) !== null).toBe(status === 'denied')
  expect(sheet.queryByRole('button', { name: i18n.t('mediaPermission.libraryAction') }) !== null).toBe(source === 'camera')
  expect(view.queryByText(i18n.t('account.avatarPermissionDenied'))).toBeNull()
  expect(view.queryByText(i18n.t('account.avatarCameraUnavailable'))).toBeNull()
  await fireEvent.press(sheet.getByRole('button', { name: i18n.t('common.cancel') }))
  await waitFor(() => expect(view.queryByTestId('media-permission-sheet')).toBeNull())
  expect(mockUpload).not.toHaveBeenCalled()
})

it.each([
  ['camera', 'denied'], ['camera', 'unavailable'], ['library', 'denied'], ['library', 'unavailable'],
] as const)('dismisses the %s %s sheet before selecting the other source', async (source, status) => {
  mockPick.mockResolvedValueOnce({ status }).mockResolvedValueOnce({ status: 'selected', asset: { uri: 'file:///fallback.jpg', width: 800, height: 600 } })
  const view = await renderScreen(<AccountScreen />)
  await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
  await fireEvent.press(await view.findByRole('button', { name: i18n.t(source === 'camera' ? 'account.avatarCamera' : 'account.avatarLibrary') }))
  const sheet = within(await view.findByTestId('media-permission-sheet'))
  await fireEvent.press(sheet.getByRole('button', { name: i18n.t(source === 'camera' ? 'mediaPermission.libraryAction' : 'mediaPermission.cameraAction') }))
  expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
  expect(view.queryByTestId('media-permission-sheet')).toBeNull()
  expect(mockPick.mock.calls.map(([pickedSource]) => pickedSource)).toEqual([source, source === 'camera' ? 'library' : 'camera'])
  expect(mockUpload).not.toHaveBeenCalled()
})

it.each(['camera', 'library'] as const)('opens Settings from the denied %s sheet, then reads fresh permission on the next attempt', async source => {
  const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
  try {
    mockPick.mockResolvedValueOnce({ status: 'denied' }).mockResolvedValueOnce({ status: 'selected', asset: { uri: 'file:///allowed.jpg', width: 800, height: 600 } })
    const view = await renderScreen(<AccountScreen />)
    const label = i18n.t(source === 'camera' ? 'account.avatarCamera' : 'account.avatarLibrary')
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: label }))
    await fireEvent.press(within(await view.findByTestId('media-permission-sheet')).getByRole('button', { name: i18n.t('account.avatarSettings') }))
    await waitFor(() => expect(settings).toHaveBeenCalledTimes(1))
    expect(view.queryByTestId('media-permission-sheet')).toBeNull()
    await fireEvent.press(view.getByLabelText('Đổi ảnh đại diện'))
    await fireEvent.press(await view.findByRole('button', { name: label }))
    expect(await view.findByText('Dùng ảnh này')).toBeTruthy()
    expect(mockPick).toHaveBeenLastCalledWith(source)
  } finally { settings.mockRestore() }
})
