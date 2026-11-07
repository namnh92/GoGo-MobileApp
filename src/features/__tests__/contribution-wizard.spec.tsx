import { act, fireEvent, screen } from '@testing-library/react-native'
import { renderScreen } from './harness'
import { contributionTaxonomies, completeWizard } from './contribution-fixtures'
import { ApiError } from '@/shared/api/errors'
import type { ContributionDraft } from '@/features/place-import/contribution-form'
import { ContributionWizard } from '@/features/place-import/contribution-wizard.view'
import i18n from '@/shared/i18n'

const mockSave = jest.fn()
const mockRead = jest.fn()
const mockRemove = jest.fn()
const mockTrack = jest.fn()
let mockTaxonomies: Record<string, unknown>
let mockDrafts: Record<string, unknown>
const mockDraftEnabled = jest.fn()
jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useContributionCredits: () => ({ data: { creditBalance: 123 } }),
  useTaxonomies: () => mockTaxonomies,
  useContributionDrafts: (enabled: boolean) => {
    mockDraftEnabled(enabled)
    return mockDrafts
  },
  useReadContributionDraft: () => ({ mutateAsync: mockRead }),
  useSaveContributionDraft: () => ({ mutateAsync: mockSave }),
  useDeleteContributionDraft: () => ({ mutateAsync: mockRemove }),
}))
const onSubmit = jest.fn()
const props = {
  googlePlaceId: 'ChIJtest',
  registered: true,
  online: true,
  submitting: false,
  blocked: false,
  onSubmit,
  onBack: jest.fn(),
  onFocus: jest.fn(),
}
const draft: ContributionDraft = {
  id: '11111111-1111-4111-8111-111111111111',
  googlePlaceId: 'ChIJtest',
  version: 3,
  enrichment: { purposeKeys: ['date'], vibeKeys: ['quiet'], visitTips: 'Old tips' },
  verificationStatus: 'unverified',
  updatedAt: '2026-11-07T00:00:00Z',
  expiresAt: '2026-12-07T00:00:00Z',
}
beforeEach(async () => {
  jest.clearAllMocks()
  await i18n.changeLanguage('vi')
  mockTaxonomies = { data: contributionTaxonomies, isPending: false, isError: false, refetch: jest.fn() }
  mockDrafts = { data: { items: [] }, isPending: false, isError: false, refetch: jest.fn() }
  mockSave.mockResolvedValue({ ...draft, version: 1 })
  mockRead.mockResolvedValue(draft)
  mockRemove.mockResolvedValue({ deleted: true })
})
const button = (name: string) => screen.getByRole('button', { name })
const disabled = (name: string) => button(name).props.accessibilityState.disabled

it('starts empty, retains selections back and forth, submits one real enrichment without sample data', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.getByText('Số dư credit: 123')).toBeTruthy()
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(true)
  expect(disabled('Tiếp tục sang Bước 2')).toBe(true)
  expect(screen.queryByRole('radio')).toBeNull()
  await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon phải thử (không bắt buộc)'), 'Bánh ngon')
  await fireEvent.press(button('Nhân viên thân thiện'))
  await fireEvent.press(button('Không gian yên tĩnh'))
  await fireEvent.press(button('Quay lại'))
  expect(button('Yên tĩnh').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Chỗ đỗ ô tô' }))
  await fireEvent.press(button('Tiếp tục sang Bước 3'))
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenCalledWith({
    purposeKeys: ['date'],
    vibeKeys: ['quiet'],
    amenities: { car_parking: true },
    recommendedDishes: 'Bánh ngon',
    service: { rating: 4, chipKeys: ['service_friendly'] },
    space: { rating: 3, chipKeys: ['space_quiet'] },
  })
  expect(screen.queryByText(/sẵn sàng nhận|nhận ngay|24 giờ/i)).toBeNull()
  expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/Bánh ngon|ChIJtest|Old tips/)
})
it('limits vibes to three without silently dropping prior selections', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Hẹn hò'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  for (const label of ['Yên tĩnh', 'Nhạc nhẹ', 'Sân vườn']) await fireEvent.press(button(label))
  expect(disabled('Sôi động')).toBe(true)
  await fireEvent.press(button('Yên tĩnh'))
  expect(disabled('Sôi động')).toBe(false)
})
it('keeps price with unit and rejects malformed, reversed and unbounded ranges', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Hẹn hò'))
  await fireEvent.press(button('Trên 200k / người'))
  expect(disabled('Tiếp tục sang Bước 2')).toBe(true)
  await fireEvent.changeText(screen.getByLabelText('Giá cao nhất (VND)'), '300000')
  await fireEvent.press(button('Mỗi nhóm'))
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({
      body: {
        googlePlaceId: 'ChIJtest',
        expectedVersion: 0,
        enrichment: { price: { min: 200001, max: 300000, currency: 'VND', unit: 'per_group' }, purposeKeys: ['date'] },
      },
    }),
  )
})
it('saves an incomplete snapshot and reuses its ID with the returned version', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Lưu nháp'))
  const first = mockSave.mock.calls[0][0]
  expect(first.body).toEqual({ googlePlaceId: 'ChIJtest', expectedVersion: 0, enrichment: {} })
  expect(first.id).toEqual(expect.any(String))
  await fireEvent.press(button('Hẹn hò'))
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave.mock.calls[1][0].body.expectedVersion).toBe(1)
  expect(JSON.stringify(mockSave.mock.calls)).not.toMatch(/resolutionToken|name|address|file:/)
})
it('resumes by GET, updates the version, and deletes by version', async () => {
  mockDrafts = { data: { items: [draft] } }
  await renderScreen(<ContributionWizard {...props} />)
  expect(disabled('Lưu nháp')).toBe(true)
  await fireEvent.press(button('Tiếp tục bản nháp'))
  expect(mockRead).toHaveBeenCalledWith(draft.id)
  expect(button('Hẹn hò').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledWith({
    id: draft.id,
    body: { googlePlaceId: 'ChIJtest', expectedVersion: 3, enrichment: draft.enrichment },
  })
  await fireEvent.press(button('Xoá bản nháp'))
  expect(mockRemove).toHaveBeenCalledWith({ id: draft.id, version: 1 })
})
it('never overwrites a conflict; explicit reload is required', async () => {
  mockSave.mockRejectedValue(new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'conflict' }))
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Lưu nháp'))
  expect(disabled('Lưu nháp')).toBe(true)
  expect(screen.getByText(/Bản nháp đã thay đổi/)).toBeTruthy()
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledTimes(1)
})
it.each([
  ['guest', { registered: false }],
  ['offline', { online: false }],
  ['submitting', { submitting: true }],
])('disables draft writes when %s', async (_name, overrides) => {
  await renderScreen(<ContributionWizard {...props} {...overrides} />)
  expect(disabled('Lưu nháp')).toBe(true)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).not.toHaveBeenCalled()
})
it.each(['loading', 'error', 'empty'])('fails closed when taxonomy is %s', async (state) => {
  mockTaxonomies =
    state === 'loading' ? { isPending: true } : state === 'error' ? { isError: true } : { data: { kinds: {} } }
  await renderScreen(<ContributionWizard {...props} />)
  expect(disabled('Tiếp tục sang Bước 2')).toBe(true)
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(true)
})
it('never invokes the picker or submits local photos while the evidence path is blocked', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  const upload = button('Tải ảnh menu/hoá đơn (tối đa 5 ảnh)')
  expect(upload.props.accessibilityState.disabled).toBe(true)
  expect(upload.props.accessibilityHint).toMatch(/quyền sở hữu/)
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('photos')
})
it('uses API labels for the selected locale and hides unlabelled keys', async () => {
  await i18n.changeLanguage('en')
  mockTaxonomies = {
    data: {
      kinds: {
        ...contributionTaxonomies.kinds,
        suitability: [{ key: 'new_kind', labels: { en: 'New occasion', vi: 'Dịp mới' } }, { key: 'missing_label' }],
      },
    },
  }
  await renderScreen(<ContributionWizard {...props} />)
  expect(button('New occasion')).toBeTruthy()
  expect(screen.queryByText('missing_label')).toBeNull()
  expect(screen.queryByText('new_kind')).toBeNull()
})
it('ignores a late draft save after changing the link unmounts this wizard', async () => {
  let finish: (value: ContributionDraft) => void = () => {}
  mockSave.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Lưu nháp'))
  await screen.unmount()
  await act(async () => {
    finish(draft)
  })
  expect(mockTrack).not.toHaveBeenCalledWith('place_contribution_draft_saved')
})
