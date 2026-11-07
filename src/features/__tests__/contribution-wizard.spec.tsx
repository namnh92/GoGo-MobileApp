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
jest.mock('@/shared/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}))
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
  enrichment: {
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
    visitTips: 'Old tips',
  },
  verificationStatus: 'unverified',
  updatedAt: '2026-11-07T00:00:00Z',
  expiresAt: '2026-12-07T00:00:00Z',
}
beforeEach(async () => {
  jest.clearAllMocks()
  await i18n.changeLanguage('vi')
  mockTaxonomies = {
    data: contributionTaxonomies,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }
  mockDrafts = {
    data: { items: [] },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }
  mockSave.mockResolvedValue({ ...draft, version: 1 })
  mockRead.mockResolvedValue(draft)
  mockRemove.mockResolvedValue({ deleted: true })
})
const button = (name: string) => screen.getByRole('button', { name })
const disabled = (name: string) => button(name).props.accessibilityState.disabled

it('starts empty, retains selections back and forth, submits one real enrichment without sample data', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.getAllByText('+50 GoGo Credit')).toHaveLength(2)
  expect(screen.queryByText('Số dư credit: 123')).toBeNull()
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(true)
  expect(disabled('Tiếp tục sang Bước 2')).toBe(true)
  expect(screen.queryByRole('radio')).toBeNull()
  await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé'), 'Bánh ngon')
  await fireEvent.press(screen.getByRole('radio', { name: 'Đánh giá phục vụ & Không gian: 4 sao' }))
  await fireEvent.press(button('Quay lại'))
  expect(button('Sôi động').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(
    screen.getByRole('checkbox', {
      name: 'Đỗ ô tô',
    }),
  )
  await fireEvent.press(button('Tiếp tục sang Bước 3'))
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenCalledWith({
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
    amenities: { car_parking: true },
    visitTips: 'Bánh ngon',
    service: { rating: 4, chipKeys: [] },
    space: { rating: 4, chipKeys: [] },
  })
  expect(screen.queryByText(/sẵn sàng nhận|nhận ngay|24 giờ/i)).toBeNull()
  expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/Bánh ngon|ChIJtest|Old tips/)
})
it('renders every API kind, including amenities and optional rating chips', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  expect(button('Thư giãn')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Wi-Fi' })).toBeTruthy()
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  await fireEvent.press(button('Sôi động'))
  await fireEvent.press(button('Tiếp tục sang Bước 3'))
  expect(disabled('Yên tĩnh')).toBe(true)
  await fireEvent.press(screen.getByRole('radio', { name: 'Đánh giá phục vụ & Không gian: 4 sao' }))
  await fireEvent.press(button('Yên tĩnh'))
  await fireEvent.press(button('Hoàn tất'))
  expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({
    service: { rating: 4, chipKeys: ['quiet'] }, space: { rating: 4, chipKeys: ['quiet'] },
  }))
})
it('keeps price with unit and rejects malformed, reversed and unbounded ranges', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Trên 200k / người'))
  expect(disabled('Tiếp tục sang Bước 2')).toBe(true)
  await fireEvent.changeText(screen.getByLabelText('Giá cao nhất (VND)'), '300000')
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({
      body: {
        googlePlaceId: 'ChIJtest',
        expectedVersion: 0,
        enrichment: {
          price: {
            min: 200001,
            max: 300000,
            currency: 'VND',
            unit: 'per_person',
          },
          purposeKeys: ['couple'],
        },
      },
    }),
  )
})
it('saves an incomplete snapshot and reuses its ID with the returned version', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Lưu nháp'))
  const first = mockSave.mock.calls[0][0]
  expect(first.body).toEqual({
    googlePlaceId: 'ChIJtest',
    expectedVersion: 0,
    enrichment: {},
  })
  expect(first.id).toEqual(expect.any(String))
  await fireEvent.press(button('Cặp đôi'))
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
  expect(button('Cặp đôi').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledWith({
    id: draft.id,
    body: {
      googlePlaceId: 'ChIJtest',
      expectedVersion: 3,
      enrichment: draft.enrichment,
    },
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
    state === 'loading'
      ? { isPending: true }
      : state === 'error'
        ? { isError: true }
        : { data: { kinds: {} } }
  await renderScreen(<ContributionWizard {...props} />)
  expect(disabled('Tiếp tục sang Bước 2')).toBe(true)
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(true)
})
it('never invokes the picker or submits local photos while the evidence path is blocked', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  const upload = button('+ Tải thêm ảnh menu/bill (Tối đa 5 ảnh)')
  expect(upload.props.accessibilityState.disabled).toBe(true)
  expect(upload.props.accessibilityHint).toMatch(/quyền sở hữu/)
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('photos')
})
it('prefers the current locale API label, falling back to i18n only without one', async () => {
  await i18n.changeLanguage('en-US')
  mockTaxonomies = { data: { kinds: { ...contributionTaxonomies.kinds,
    suitability: [
      { key: 'couple', labels: { en: 'CMS couple', vi: 'Cặp đôi' } },
      { key: 'group' },
      { key: 'new_kind', labels: { en: 'New occasion' } },
    ],
  } } }
  await renderScreen(<ContributionWizard {...props} />)
  expect(button('CMS couple')).toBeTruthy()
  expect(button('Meet friends')).toBeTruthy()
  expect(button('New occasion')).toBeTruthy()
  expect(screen.queryByText('Romantic date')).toBeNull()
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

it('submits with the whole optional step empty using either Finish or Send, with no photo bonus', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  expect(screen.getByText('Chưa đánh giá')).toBeTruthy()
  expect(screen.getAllByText('Không bắt buộc')).toHaveLength(3)
  expect(screen.queryByText('+70 GoGo Credit')).toBeNull()
  expect(disabled('Hoàn tất')).toBe(false)
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(false)
  await fireEvent.press(button('Hoàn tất'))
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenNthCalledWith(1, {
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
  })
  expect(onSubmit).toHaveBeenNthCalledWith(2, {
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
  })
})
it('allows tips alone, rating alone, and clearing the optional rating without blocking completion', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  const tips = screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé')
  await fireEvent.changeText(tips, 'Real tip')
  await fireEvent.press(button('Hoàn tất'))
  expect(onSubmit).toHaveBeenLastCalledWith({
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
    visitTips: 'Real tip',
  })
  await fireEvent.changeText(tips, '')
  const star = screen.getByRole('radio', {
    name: 'Đánh giá phục vụ & Không gian: 5 sao',
  })
  await fireEvent.press(star)
  expect(screen.getByText('5.0 - Tuyệt vời')).toBeTruthy()
  await fireEvent.press(button('Hoàn tất'))
  expect(onSubmit).toHaveBeenLastCalledWith({
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
    service: { rating: 5, chipKeys: [] },
    space: { rating: 5, chipKeys: [] },
  })
  await fireEvent.press(star)
  expect(disabled('Hoàn tất')).toBe(false)
  expect(screen.getByText('Chưa đánh giá')).toBeTruthy()
})

it('keeps both legacy text values visible in the single input and saves an explicit replacement', async () => {
  mockDrafts = { data: { items: [draft] } }
  mockRead.mockResolvedValue({
    ...draft,
    enrichment: {
      ...draft.enrichment,
      recommendedDishes: 'Cake',
      visitTips: 'Morning',
      service: { rating: 4, chipKeys: ['service_retired'] },
    },
  })
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Tiếp tục bản nháp'))
  expect(disabled('Tiếp tục sang Bước 2')).toBe(true)
  expect(disabled('Lưu nháp')).toBe(true)
  await fireEvent.press(button('Bỏ lựa chọn không còn khả dụng'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  await fireEvent.press(button('Tiếp tục sang Bước 3'))
  const field = screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé')
  expect(field.props.value).toBe('Cake — Morning')
  await fireEvent.press(button('Hoàn tất'))
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      recommendedDishes: 'Cake',
      visitTips: 'Morning',
      service: { rating: 4, chipKeys: [] },
    }),
  )
  await fireEvent.changeText(field, 'My combined tip')
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave.mock.calls[0][0].body.enrichment).toMatchObject({ visitTips: 'My combined tip' })
  expect(mockSave.mock.calls[0][0].body.enrichment).not.toHaveProperty('recommendedDishes')
})
it('uses CMS sort order, limits amenities to five rows and keeps a selected overflow row visible', async () => {
  mockTaxonomies = { data: { kinds: { ...contributionTaxonomies.kinds,
    amenity: Array.from({ length: 8 }, (_, i) => ({ key: `amenity_${i}`, sortOrder: 7 - i, labels: { vi: `Tiện ích ${i}` } })),
  } } }
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  expect(screen.getAllByRole('checkbox').map((row) => row.props.accessibilityLabel)).toEqual(['Tiện ích 7', 'Tiện ích 6', 'Tiện ích 5', 'Tiện ích 4', 'Tiện ích 3'])
  await fireEvent.press(button('Xem tất cả 8 tiện ích'))
  await fireEvent.changeText(screen.getByLabelText('Tìm lựa chọn'), 'Tiện ích 0')
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Tiện ích 0' }))
  await fireEvent.press(button('Xong'))
  expect(screen.getByRole('checkbox', { name: 'Tiện ích 0' }).props.accessibilityState.checked).toBe(true)
  expect(screen.getAllByRole('checkbox')).toHaveLength(5)
})
it('supports 40 moods with search, groups, a max-three counter and selected overflow chips', async () => {
  mockTaxonomies = { data: { kinds: { ...contributionTaxonomies.kinds,
    mood: Array.from({ length: 40 }, (_, i) => ({ key: `mood_${i}`, labels: { vi: `Vibe ${i}` }, group: i < 20 ? 'Không gian' : 'Âm nhạc' })),
  } } }
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  expect(screen.queryByText('Vibe 6')).toBeNull()
  await fireEvent.press(button('+34 khác'))
  expect(screen.getByText('Đã chọn 0/3')).toBeTruthy()
  expect(screen.getByText('Âm nhạc')).toBeTruthy()
  await fireEvent.changeText(screen.getByLabelText('Tìm lựa chọn'), 'Vibe 39')
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Vibe 39' }))
  expect(screen.getByText('Đã chọn 1/3')).toBeTruthy()
  await fireEvent.changeText(screen.getByLabelText('Tìm lựa chọn'), '')
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Vibe 38' }))
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Vibe 37' }))
  expect(screen.getByRole('checkbox', { name: 'Vibe 36' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button('Xong'))
  expect(button('Vibe 39').props.accessibilityState.selected).toBe(true)
  expect(button('Vibe 37').props.accessibilityState.selected).toBe(true)
  expect(screen.queryByText('Vibe 3')).toBeNull()
  await fireEvent.press(button('+34 khác'))
  await fireEvent.changeText(screen.getByLabelText('Tìm lựa chọn'), 'no match')
  expect(screen.getByText('Không tìm thấy lựa chọn.')).toBeTruthy()
})
it('caps purpose and rating chips at six, with API choices available through their sheets', async () => {
  mockTaxonomies = { data: { kinds: { ...contributionTaxonomies.kinds,
    suitability: Array.from({ length: 9 }, (_, i) => ({ key: `purpose_${i}`, labels: { vi: `Dịp ${i}` } })),
    checkin_tag: Array.from({ length: 9 }, (_, i) => ({ key: `tag_${i}`, labels: { vi: `Đánh giá ${i}` } })),
  } } }
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.queryByText('Dịp 6')).toBeNull()
  await fireEvent.press(button('+3 khác'))
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Dịp 8' }))
  await fireEvent.press(button('Xong'))
  expect(button('Dịp 8').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  await fireEvent.press(button('Sôi động'))
  await fireEvent.press(button('Tiếp tục sang Bước 3'))
  await fireEvent.press(screen.getByRole('radio', { name: 'Đánh giá phục vụ & Không gian: 5 sao' }))
  expect(screen.queryByText('Đánh giá 6')).toBeNull()
  await fireEvent.press(button('+3 khác'))
  for (const n of [8, 7, 6, 5, 4]) await fireEvent.press(screen.getByRole('checkbox', { name: `Đánh giá ${n}` }))
  expect(screen.getByText('Đã chọn 5/5')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Đánh giá 3' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button('Xong'))
  await fireEvent.press(button('Hoàn tất'))
  expect(onSubmit).toHaveBeenLastCalledWith({
    purposeKeys: ['purpose_8'], vibeKeys: ['festive'],
    service: { rating: 5, chipKeys: ['tag_8', 'tag_7', 'tag_6', 'tag_5', 'tag_4'] },
    space: { rating: 5, chipKeys: ['tag_8', 'tag_7', 'tag_6', 'tag_5', 'tag_4'] },
  })
})
it('rejects stale amenity and rating keys from a resumed draft instead of silently rewriting them', async () => {
  mockDrafts = { data: { items: [draft] } }
  mockRead.mockResolvedValue({ ...draft, enrichment: { ...draft.enrichment,
    amenities: { retired: true }, space: { rating: 4, chipKeys: ['retired_tag'] },
  } })
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Tiếp tục bản nháp'))
  expect(disabled('Lưu nháp')).toBe(true)
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(true)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).not.toHaveBeenCalled()
  await fireEvent.press(button('Bỏ lựa chọn không còn khả dụng'))
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave.mock.calls[0][0].body.enrichment).toEqual({ ...draft.enrichment, space: { rating: 4, chipKeys: [] } })
})
it('preserves explicit false claims while editing another amenity', async () => {
  mockDrafts = { data: { items: [draft] } }
  mockRead.mockResolvedValue({ ...draft, enrichment: { ...draft.enrichment, amenities: { car_parking: false } } })
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Tiếp tục bản nháp'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Wi-Fi' }))
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave.mock.calls[0][0].body.enrichment.amenities).toEqual({ car_parking: false, wifi: true })
})
