import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { renderScreen } from './harness'
import { ApiError, NetworkError } from '@/shared/api/errors'
import type { ContributionDraft } from '@/features/place-import/contribution-form'
import i18n from '@/shared/i18n'
import { beginSessionEnd, clearSession, persistSession, type Session } from '@/shared/api/session'
const mockRead = jest.fn()
const mockSave = jest.fn()
const mockRemove = jest.fn()
const mockPost = jest.fn()
const mockList = jest.fn()
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() }
const mockResolution = { status: 'RESOLVED', candidate: { googlePlaceId: 'place-a', name: 'Test café' } }
const mockResolve = { data: undefined as unknown, reset: jest.fn(), mutate: jest.fn((_body, callbacks) => callbacks.onSuccess(mockResolution)), isPending: false }
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  ...jest.requireActual('./contribution-fixtures').contributionHooks(),
  useResolveGoogleMapsLink: () => mockResolve,
  useSubmitPlace: () => ({ mutateAsync: mockPost, reset: jest.fn() }),
  useContributionDrafts: () => ({ data: { items: [mockDraft] } }),
  useReadContributionDraft: () => ({ mutateAsync: mockRead }),
  useSaveContributionDraft: () => ({ mutateAsync: mockSave }),
  useDeleteContributionDraft: () => ({ mutateAsync: mockRemove }),
  listContributionDrafts: () => mockList(),
  getContributionDraft: (id: string) => mockRead(id),
  saveContributionDraft: (id: string, body: unknown) => mockSave({ id, body }),
  deleteContributionDraft: (id: string, version: number) => mockRemove({ id, version }),
  submitPlace: (body: unknown) => mockPost(body),
}))
import PlaceImportScreen from '@/features/place-import/import.view'
const mockDraft: ContributionDraft = { id: 'draft-a', googlePlaceId: 'place-a', version: 3,
  enrichment: { purposeKeys: ['couple'], vibeKeys: ['festive'], visitTips: 'keep', photos: [{ mediaId: 'bill-a', kind: 'bill' }], billPhotoPublicConsent: true },
  expiresAt: '2027-01-01T00:00:00Z', updatedAt: '2026-11-07T00:00:00Z', verificationStatus: 'unverified' }
const button = (name: string) => screen.getByRole('button', { name })
async function resume() {
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), 'https://maps.app.goo.gl/A')
  mockResolve.data = mockResolution
  await fireEvent.press(button('Tiếp tục trích xuất thông tin'))
  await fireEvent.press(button('Tiếp tục bản nháp'))
  await fireEvent.press(button('Tiếp tục')); await fireEvent.press(button('Tiếp tục'))
}
beforeEach(async () => {
  jest.clearAllMocks(); onlineManager.setOnline(true); await i18n.changeLanguage('vi')
  mockResolve.data = undefined; mockRead.mockResolvedValue(mockDraft)
  mockList.mockResolvedValue({ items: [mockDraft] }); mockPost.mockResolvedValue({ status: 'PENDING', submissionId: 'submission-a' }); mockRemove.mockResolvedValue({ deleted: true })
})
it('M11 accepted POST retires immediately, shows retry cleanup, never resubmits or deletes media', async () => {
  mockRemove.mockRejectedValueOnce(new NetworkError())
  await resume(); await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(mockRemove).toHaveBeenCalledWith({ id: mockDraft.id, version: 3 })
  expect(screen.queryByTestId('contribution-wizard')).toBeNull()
  expect(screen.getAllByText(i18n.t('placeWizard.lifecycle.submittedCleanupPending')).length).toBeGreaterThan(0)
  const retry = screen.getAllByRole('button', { name: 'Thử dọn bản nháp lại' })[0]
  await fireEvent.press(retry)
  expect(mockPost).toHaveBeenCalledTimes(1); expect(mockRemove).toHaveBeenCalledTimes(2)
  expect(mockRemove).toHaveBeenLastCalledWith({ id: mockDraft.id, version: 3 })
  expect(mockPost.mock.calls[0][0].enrichment).toEqual(mockDraft.enrichment)
})
it('M11 cleanup version mismatch requires visible review and a second explicit delete action', async () => {
  mockRemove.mockRejectedValueOnce(new ApiError(404, { code: 'NOT_FOUND', message: 'version mismatch' }))
  await resume(); mockRead.mockResolvedValueOnce({ ...mockDraft, version: 7, enrichment: { ...mockDraft.enrichment, visitTips: 'New device edit to review' } }); await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockRemove).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Xoá phiên bản mới nhất' })).toBeNull()
  await fireEvent.press(button('Xem lại bản nháp đã thay đổi'))
  expect(screen.getByText('Phiên bản nháp 7 trên máy chủ.')).toBeTruthy()
  expect(screen.getByText('New device edit to review')).toBeTruthy()
  await fireEvent.press(button('Xoá phiên bản mới nhất'))
  expect(mockRemove).toHaveBeenLastCalledWith({ id: mockDraft.id, version: 7 }); expect(mockPost).toHaveBeenCalledTimes(1)
})
it('M12 lost submission response offers Check my contributions, no blind retry/save/cleanup', async () => {
  mockPost.mockRejectedValueOnce(new NetworkError()); await resume(); await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  const sheet = within(screen.getByTestId('result-sheet'))
  expect(sheet.getByText(i18n.t('placeWizard.lifecycle.submissionUnconfirmed'))).toBeTruthy()
  expect(sheet.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  expect(sheet.getByRole('button', { name: 'Lưu nháp' }).props.accessibilityState.disabled).toBe(true)
  expect(mockRemove).not.toHaveBeenCalled(); expect(mockPost).toHaveBeenCalledTimes(1)
  await fireEvent.press(sheet.getByRole('button', { name: 'Kiểm tra đóng góp của tôi' }))
  expect(mockPost).toHaveBeenCalledTimes(1)
})
it('M12 ALREADY_EXISTS retains active recovery and photos, without cleanup', async () => {
  mockPost.mockResolvedValueOnce({ status: 'ALREADY_EXISTS' }); await resume(); await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(screen.getByText(i18n.t('placeWizard.lifecycle.alreadyExists'))).toBeTruthy()
  expect(button('Xoá bản nháp')).toBeTruthy(); expect(button('Xoá ảnh hoá đơn')).toBeTruthy(); expect(mockRemove).not.toHaveBeenCalled()
})
it('M09 invalid submit media exposes usable no-photo recovery with unchanged draft version', async () => {
  mockPost.mockRejectedValueOnce(new ApiError(400, { code: 'INVALID_SUBMISSION_PHOTOS', message: 'invalid' }))
  await resume(); await fireEvent.press(button('Gửi địa điểm cho GoGo')); await fireEvent.press(button('Tiếp tục không có ảnh'))
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(mockPost.mock.calls[1][0].enrichment).not.toHaveProperty('photos')
  expect(mockRemove).toHaveBeenCalledWith({ id: mockDraft.id, version: 3 })
})
it('M15 local photo removal works offline while network actions stay disabled', async () => {
  await resume(); await act(async () => onlineManager.setOnline(false))
  expect(button('Lưu nháp').props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button('Xoá ảnh hoá đơn')); expect(screen.queryByRole('button', { name: 'Xoá ảnh hoá đơn' })).toBeNull()
  expect(mockPost).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled()
})
it('M01 valid menu/bill round trip replaces server snapshot/version without merging prior draft photos', async () => {
  await resume(); mockSave.mockImplementationOnce(({ id, body }) => Promise.resolve({ ...mockDraft, id, version: 4, enrichment: body.enrichment }))
  await fireEvent.press(button('Lưu nháp')); expect(mockSave.mock.calls[0][0].body.enrichment).toEqual(mockDraft.enrichment)
  await fireEvent.press(button('Gửi địa điểm cho GoGo')); expect(mockPost.mock.calls[0][0].enrichment).toEqual(mockDraft.enrichment)
})

const accountA: Session = { kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 }
it.each(['logout', 'switch', 'A-B-A', 'expiry', 'guest-user'] as const)('T13 %s blanks the mounted wizard, preview, result and form', async transition => {
  await persistSession(transition === 'guest-user' ? { kind: 'guest', roomId: 'room-A', accessToken: 'guest', expiresAt: accountA.expiresAt } : accountA)
  await resume()
  expect(screen.getByRole('button', { name: 'Xoá ảnh hoá đơn' })).toBeTruthy()
  if (transition === 'expiry') {
    mockPost.mockRejectedValueOnce(new NetworkError())
    await fireEvent.press(button('Gửi địa điểm cho GoGo'))
    expect(screen.getByTestId('result-sheet')).toBeTruthy()
  }
  await act(async () => {
    if (transition === 'logout') beginSessionEnd()
    else if (transition === 'expiry') await clearSession()
    else {
      await persistSession({ ...accountA, userId: 'B', accessToken: 'B' })
      if (transition === 'A-B-A') await persistSession(accountA)
    }
  })
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  expect(screen.queryByTestId('contribution-wizard')).toBeNull()
  expect(screen.queryByTestId('result-sheet')).toBeNull()
  expect(screen.queryByText('keep')).toBeNull()
  // Resolve the same place in the new session: no prior step, bill ids or form fields.
  mockList.mockResolvedValue({ items: [] })
  await fireEvent.changeText(screen.getByTestId('import-link-input'), 'https://maps.app.goo.gl/B')
  await fireEvent.press(button('Tiếp tục trích xuất thông tin'))
  expect(screen.getByTestId('contribution-wizard')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Xoá ảnh hoá đơn' })).toBeNull()
  expect(screen.queryByDisplayValue('keep')).toBeNull()
  await screen.unmount()
  await clearSession()
})

it('T13 clears the draft expiry timer synchronously when logout starts', async () => {
  await persistSession(accountA)
  const schedule = jest.spyOn(globalThis, 'setTimeout')
  const cancel = jest.spyOn(globalThis, 'clearTimeout')
  try {
    await resume()
    const index = schedule.mock.calls.findIndex(([, delay]) => delay === 2_147_483_647)
    expect(index).toBeGreaterThanOrEqual(0)
    const timer = schedule.mock.results[index].value
    await act(async () => {
      beginSessionEnd()
      // Before React runs the reset's effect cleanup.
      expect(cancel).toHaveBeenCalledWith(timer)
    })
  } finally {
    await screen.unmount()
    schedule.mockRestore(); cancel.mockRestore()
    await clearSession()
  }
})

it('T13 ignores late resolve callbacks and remounts local validation state', async () => {
  await persistSession(accountA)
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), 'not a link')
  await fireEvent.press(button('Tiếp tục trích xuất thông tin'))
  let success!: (value: typeof mockResolution) => void
  mockResolve.mutate.mockImplementationOnce((_body, callbacks) => { success = callbacks.onSuccess })
  await fireEvent.changeText(screen.getByTestId('import-link-input'), 'https://maps.app.goo.gl/A')
  await fireEvent.press(button('Tiếp tục trích xuất thông tin'))
  await act(async () => { await persistSession({ ...accountA, userId: 'B', accessToken: 'B' }); success(mockResolution) })
  expect(screen.getByTestId('import-link-input').props.value).toBe('')
  expect(screen.queryByTestId('contribution-wizard')).toBeNull()
  await screen.unmount()
  await clearSession()
})
