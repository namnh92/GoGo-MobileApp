jest.mock('@/shared/administrative/queries', () => ({ useAdministrativeVersion: () => ({ data: { datasetVersion: 'v1' } }) }))
jest.mock('@/shared/administrative/administrative-picker.view', () => ({ AdministrativePicker: () => null }))
import { act, fireEvent } from '@testing-library/react-native'

import { loaded, renderScreen, type QueryLike } from './harness'

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

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', deleteAccount: jest.fn() }),
}))

jest.mock('@/shared/media/pick-avatar', () => ({ pickAvatar: () => mockPick() }))

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

beforeEach(() => {
  mockMe.query = loaded(profile())
  mockUpload.mockReset()
  mockSetAvatar.mockReset()
  mockRemoveAvatar.mockReset()
  mockPick.mockReset()
})

describe('account avatar', () => {
  it('is disabled with the reason before a picker opens when the environment cannot take one', async () => {
    mockMe.query = loaded(profile({ capabilities: { avatarUpload: 'unavailable' } }))
    const view = await renderScreen(<AccountScreen />)
    expect(view.getByText('Tải ảnh chưa khả dụng ở môi trường này.')).toBeTruthy()
    const change = view.getByText('Đổi ảnh')
    fireEvent.press(change)
    expect(mockPick).not.toHaveBeenCalled()
  })

  it('picks, uploads for the avatar purpose, attaches, and says so', async () => {
    mockPick.mockResolvedValue({ status: 'picked', image: { uri: 'file:///a.jpg', mimeType: 'image/jpeg' } })
    mockUpload.mockResolvedValue('tmp/avatars/u1/k.jpg')
    mockSetAvatar.mockResolvedValue(profile({ avatarUrl: 'https://assets-test.local/avatars/x.webp' }))
    const view = await renderScreen(<AccountScreen />)

    await act(async () => {
      fireEvent.press(view.getByText('Đổi ảnh'))
    })

    expect(mockUpload).toHaveBeenCalledWith({
      image: { uri: 'file:///a.jpg', mimeType: 'image/jpeg' },
      purpose: 'avatar',
    })
    expect(mockSetAvatar).toHaveBeenCalledWith('tmp/avatars/u1/k.jpg')
    expect(await view.findByText('✓ Đã cập nhật ảnh')).toBeTruthy()
  })

  it('tells the person to pick another image when the server cannot read this one', async () => {
    mockPick.mockResolvedValue({ status: 'picked', image: { uri: 'file:///a.jpg', mimeType: 'image/jpeg' } })
    mockUpload.mockResolvedValue('tmp/avatars/u1/k.jpg')
    mockSetAvatar.mockRejectedValue(
      new ApiError(422, { code: 'AVATAR_UNPROCESSABLE', message: 'The image could not be read' }),
    )
    const view = await renderScreen(<AccountScreen />)
    await act(async () => {
      fireEvent.press(view.getByText('Đổi ảnh'))
    })
    expect(await view.findByText('Ảnh không đọc được. Chọn ảnh khác nhé.')).toBeTruthy()
  })

  it('says the server is busy for a retryable refusal, and never shows a local preview as saved', async () => {
    mockPick.mockResolvedValue({ status: 'picked', image: { uri: 'file:///a.jpg', mimeType: 'image/jpeg' } })
    mockUpload.mockResolvedValue('tmp/avatars/u1/k.jpg')
    mockSetAvatar.mockRejectedValue(
      new ApiError(503, { code: 'AVATAR_BUSY', message: 'busy', retryable: true }),
    )
    const view = await renderScreen(<AccountScreen />)
    await act(async () => {
      fireEvent.press(view.getByText('Đổi ảnh'))
    })
    expect(await view.findByText('Máy chủ đang bận. Thử lại sau ít phút.')).toBeTruthy()
    expect(view.queryByTestId('avatar-image')).toBeNull()
  })

  it('names the missing permission and uploads nothing', async () => {
    mockPick.mockResolvedValue({ status: 'denied' })
    const view = await renderScreen(<AccountScreen />)
    await act(async () => {
      fireEvent.press(view.getByText('Đổi ảnh'))
    })
    expect(await view.findByText(/Chưa có quyền truy cập ảnh/)).toBeTruthy()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('refuses a format it cannot convert before any bytes move', async () => {
    mockPick.mockResolvedValue({ status: 'unsupported' })
    const view = await renderScreen(<AccountScreen />)
    await act(async () => {
      fireEvent.press(view.getByText('Đổi ảnh'))
    })
    expect(await view.findByText(/Chọn ảnh JPG hoặc PNG/)).toBeTruthy()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('offers removal only when there is a picture, and removes on the server', async () => {
    const plain = await renderScreen(<AccountScreen />)
    expect(plain.queryByText('Gỡ ảnh')).toBeNull()
    plain.unmount()

    mockMe.query = loaded(profile({ avatarUrl: 'https://assets-test.local/avatars/x.webp' }))
    mockRemoveAvatar.mockResolvedValue(profile())
    const view = await renderScreen(<AccountScreen />)
    await act(async () => {
      fireEvent.press(view.getByText('Gỡ ảnh'))
    })
    expect(mockRemoveAvatar).toHaveBeenCalledTimes(1)
    expect(await view.findByText('✓ Đã gỡ ảnh')).toBeTruthy()
  })
})
