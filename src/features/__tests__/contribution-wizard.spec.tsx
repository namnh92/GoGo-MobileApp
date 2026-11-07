import { StyleSheet } from 'react-native'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
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
  expect(screen.getByLabelText('+50 GoGo Credit khi được duyệt')).toBeTruthy()
  expect(screen.getByText('+50').props.numberOfLines).toBe(1)
  expect(screen.queryByText('Số dư credit: 123')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toBeNull()
  expect(disabled('Tiếp tục')).toBe(true)
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
  await fireEvent.press(button('Tiếp tục'))
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
  await fireEvent.press(button('Tiếp tục'))
  expect(button('Thư giãn')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Wi-Fi' })).toBeTruthy()
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  await fireEvent.press(button('Sôi động'))
  await fireEvent.press(button('Tiếp tục'))
  expect(disabled('Yên tĩnh')).toBe(true)
  await fireEvent.press(screen.getByRole('radio', { name: 'Đánh giá phục vụ & Không gian: 4 sao' }))
  await fireEvent.press(button('Yên tĩnh'))
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({
    service: { rating: 4, chipKeys: ['quiet'] }, space: { rating: 4, chipKeys: ['quiet'] },
  }))
})
it('keeps price with unit and rejects malformed, reversed and unbounded ranges', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Trên 200k / người'))
  expect(disabled('Tiếp tục')).toBe(true)
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
it('retains acknowledged menu/bill uploads when a resumed draft is edited, saved and submitted', async () => {
  const photoDraft: ContributionDraft = {
    ...draft,
    enrichment: {
      ...draft.enrichment,
      photos: [
        { mediaId: '22222222-2222-4222-8222-222222222222', kind: 'menu' },
        { mediaId: '33333333-3333-4333-8333-333333333333', kind: 'bill' },
      ],
      billPhotoPublicConsent: true,
    },
  }
  mockDrafts = { data: { items: [photoDraft] } }
  mockRead.mockResolvedValue(photoDraft)
  mockSave.mockResolvedValue({ ...photoDraft, version: 4 })
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Tiếp tục bản nháp'))
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.changeText(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé'), 'Updated tip')
  const enrichment = { ...photoDraft.enrichment, visitTips: 'Updated tip' }
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledWith({
    id: photoDraft.id,
    body: { googlePlaceId: props.googlePlaceId, expectedVersion: 3, enrichment },
  })
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenCalledWith(enrichment)
})
describe('F-05 deleted draft media', () => {
  const photoDraft: ContributionDraft = {
    ...draft,
    enrichment: {
      ...draft.enrichment,
      price: { min: 100000, max: 200000, currency: 'VND', unit: 'per_person' },
      amenities: { car_parking: true },
      service: { rating: 4, chipKeys: ['quiet'] },
      space: { rating: 4, chipKeys: ['quiet'] },
      photos: [
        { mediaId: '22222222-2222-4222-8222-222222222222', kind: 'menu' },
        { mediaId: '33333333-3333-4333-8333-333333333333', kind: 'bill' },
      ],
      billPhotoPublicConsent: true,
    },
  }
  async function resumeAndEdit() {
    mockDrafts = { data: { items: [photoDraft] } }
    mockRead.mockResolvedValue(photoDraft)
    await renderScreen(<ContributionWizard {...props} />)
    await fireEvent.press(button('Tiếp tục bản nháp'))
    await fireEvent.press(button('Tiếp tục'))
    await fireEvent.press(button('Tiếp tục'))
    await fireEvent.changeText(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé'), 'Keep my edited tips')
  }

  it.each(['save', 'submit'])('clears expired photos and consent but preserves inputs before %s', async (action) => {
    await resumeAndEdit()
    await fireEvent.press(button('Xoá bản nháp'))
    expect(mockRemove).toHaveBeenCalledWith({ id: photoDraft.id, version: photoDraft.version })
    const enrichment = {
      price: photoDraft.enrichment.price,
      purposeKeys: ['couple'],
      vibeKeys: ['festive'],
      amenities: { car_parking: true },
      visitTips: 'Keep my edited tips',
      service: { rating: 4, chipKeys: ['quiet'] },
      space: { rating: 4, chipKeys: ['quiet'] },
    }
    if (action === 'save') {
      await fireEvent.press(button('Lưu nháp'))
      expect(mockSave).toHaveBeenCalledWith({
        id: expect.any(String),
        body: { googlePlaceId: props.googlePlaceId, expectedVersion: 0, enrichment },
      })
      expect(mockSave.mock.calls[0][0].id).not.toBe(photoDraft.id)
    } else {
      await fireEvent.press(button('Gửi địa điểm cho GoGo'))
      expect(onSubmit).toHaveBeenCalledWith(enrichment)
    }
    // The stale query cache must not offer to resume the deleted draft or block saving.
    expect(screen.queryByRole('button', { name: 'Tiếp tục bản nháp' })).toBeNull()
  })

  it('retains live photos, consent and draft identity when deletion fails', async () => {
    await resumeAndEdit()
    mockRemove.mockRejectedValueOnce(new ApiError(503, { code: 'UNAVAILABLE', message: 'retry' }))
    await fireEvent.press(button('Xoá bản nháp'))
    const enrichment = { ...photoDraft.enrichment, visitTips: 'Keep my edited tips' }
    await fireEvent.press(button('Gửi địa điểm cho GoGo'))
    expect(onSubmit).toHaveBeenCalledWith(enrichment)
    await fireEvent.press(button('Lưu nháp'))
    expect(mockSave).toHaveBeenCalledWith({
      id: photoDraft.id,
      body: { googlePlaceId: props.googlePlaceId, expectedVersion: photoDraft.version, enrichment },
    })
  })
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
  expect(disabled('Tiếp tục')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toBeNull()
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

it('submits once through the sole primary action with the whole optional step empty', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  expect(screen.queryByText('Chưa đánh giá')).toBeNull()
  expect(screen.getAllByText('Không bắt buộc')).toHaveLength(3)
  expect(screen.queryByText('+70 GoGo Credit')).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Hoàn tất' })).toBeNull()
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(false)
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenCalledTimes(1)
  expect(onSubmit).toHaveBeenCalledWith({ purposeKeys: ['couple'], vibeKeys: ['festive'] })
})
it('allows tips alone, rating alone, and clearing the optional rating without blocking completion', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  const tips = screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé')
  await fireEvent.changeText(tips, 'Real tip')
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
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
  expect(star.props.accessibilityState.checked).toBe(true)
  expect(screen.queryByText('5.0 - Tuyệt vời')).toBeNull()
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenLastCalledWith({
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
    service: { rating: 5, chipKeys: [] },
    space: { rating: 5, chipKeys: [] },
  })
  await fireEvent.press(star)
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(false)
  expect(screen.queryByText('Chưa đánh giá')).toBeNull()
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
  expect(disabled('Tiếp tục')).toBe(true)
  expect(disabled('Lưu nháp')).toBe(true)
  await fireEvent.press(button('Bỏ lựa chọn không còn khả dụng'))
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(button('Tiếp tục'))
  const field = screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé')
  expect(field.props.value).toBe('Cake — Morning')
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
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
  await fireEvent.press(button('Tiếp tục'))
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
  await fireEvent.press(button('Tiếp tục'))
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
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(button('Sôi động'))
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(screen.getByRole('radio', { name: 'Đánh giá phục vụ & Không gian: 5 sao' }))
  expect(screen.queryByText('Đánh giá 6')).toBeNull()
  await fireEvent.press(button('+3 khác'))
  for (const n of [8, 7, 6, 5, 4]) await fireEvent.press(screen.getByRole('checkbox', { name: `Đánh giá ${n}` }))
  expect(screen.getByText('Đã chọn 5/5')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Đánh giá 3' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button('Xong'))
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
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
  expect(screen.queryByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toBeNull()
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
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Wi-Fi' }))
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave.mock.calls[0][0].body.enrichment.amenities).toEqual({ car_parking: false, wifi: true })
})


it('keeps one primary action through all steps and a compact accessible reward', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Tiếp tục' })).toHaveLength(1)
  expect(disabled('Tiếp tục')).toBe(true)
  expect(screen.getByLabelText('+50 GoGo Credit khi được duyệt')).toBeTruthy()
  expect(screen.getByText('+50').props.numberOfLines).toBe(1)
  expect(screen.queryByText(/GoGo Credit/)).toBeNull()
  await fireEvent.press(button('Cặp đôi'))
  expect(disabled('Tiếp tục')).toBe(false)
  await fireEvent.press(button('Tiếp tục'))
  expect(disabled('Tiếp tục')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toBeNull()
  expect(button('Quay lại')).toBeTruthy()
  await fireEvent.press(button('Sôi động'))
  expect(disabled('Tiếp tục')).toBe(false)
  await fireEvent.press(button('Tiếp tục'))
  const submit = button('Gửi địa điểm cho GoGo')
  expect(screen.getAllByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
  const save = button('Lưu nháp')
  expect(StyleSheet.flatten(save.props.style)).toMatchObject({ width: '100%', height: 56, borderWidth: 1 })
  expect(StyleSheet.flatten(submit.props.style)).toMatchObject({ width: '100%', minWidth: 0, height: 56 })
  expect(within(submit).getByText('Gửi địa điểm cho GoGo').props.numberOfLines).toBe(1)
  await fireEvent.press(button('Quay lại'))
  expect(button('Sôi động').props.accessibilityState.selected).toBe(true)
  expect(screen.queryByRole('button', { name: 'Gửi địa điểm cho GoGo' })).toBeNull()
  expect(disabled('Tiếp tục')).toBe(false)
})

it.each([404, 503, 0])('silently tolerates draft-list failure %i and allows saving and submission', async (status) => {
  const error = status ? new ApiError(status, { code: 'UNAVAILABLE', message: 'private data' }) : new Error('private data')
  mockDrafts = { isError: true, error }
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.queryByText(/Không thể tải bản nháp/)).toBeNull()
  expect(disabled('Lưu nháp')).toBe(false)
  if (status === 404) expect(mockTrack).not.toHaveBeenCalled()
  else expect(mockTrack).toHaveBeenCalledWith('place_contribution_draft_read_failed', { operation: 'list', status })
  await completeWizard()
  await fireEvent.press(button('Gửi địa điểm cho GoGo'))
  expect(onSubmit).toHaveBeenCalled()
  expect(screen.queryByText(/Không lưu được/)).toBeNull()
  mockSave.mockRejectedValue(new ApiError(503, { code: 'UNAVAILABLE', message: 'private data' }))
  await fireEvent.press(button('Lưu nháp'))
  expect(screen.getByText(i18n.t('placeWizard.draft.failed'))).toBeTruthy()
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(false)
  expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/private data|ChIJtest/)
})

it.each([404, 503])('silently tolerates resume failure %i without changing entered data or blocking submission', async (status) => {
  mockDrafts = { data: { items: [draft] } }
  mockRead.mockRejectedValue(new ApiError(status, { code: 'UNAVAILABLE', message: 'private data' }))
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Tiếp tục bản nháp'))
  expect(button('Cặp đôi').props.accessibilityState.selected).toBe(true)
  expect(screen.queryByText(i18n.t('placeWizard.draft.failed'))).toBeNull()
  if (status === 404) {
    expect(disabled('Lưu nháp')).toBe(false)
    expect(mockTrack).not.toHaveBeenCalled()
  } else expect(mockTrack).toHaveBeenCalledWith('place_contribution_draft_read_failed', { operation: 'resume', status })
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(button('Sôi động'))
  await fireEvent.press(button('Tiếp tục'))
  expect(disabled('Gửi địa điểm cho GoGo')).toBe(false)
})


it('treats a 404 list as absent even with cached drafts, and keeps an empty form', async () => {
  mockDrafts = { data: { items: [draft] }, isError: true,
    error: new ApiError(404, { code: 'NOT_FOUND', message: 'missing' }) }
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.queryByRole('button', { name: 'Tiếp tục bản nháp' })).toBeNull()
  expect(button('Cặp đôi').props.accessibilityState.selected).toBe(false)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave.mock.calls[0][0].body).toMatchObject({ expectedVersion: 0, enrichment: {} })
})

it('keeps deletion failures silent with telemetry', async () => {
  mockDrafts = { data: { items: [draft] } }
  mockRemove.mockRejectedValue(new Error('private data'))
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Xoá bản nháp'))
  expect(screen.queryByText(i18n.t('placeWizard.draft.failed'))).toBeNull()
  expect(mockTrack).toHaveBeenCalledWith('place_contribution_draft_delete_failed', { status: 0 })
})


it('distributes all five stars across the content width with 44pt touch targets', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  const stars = screen.getAllByRole('radio')
  expect(stars).toHaveLength(5)
  for (const star of stars) expect(StyleSheet.flatten(star.props.style)).toMatchObject({ width: 44, minHeight: 44 })
  expect(StyleSheet.flatten(stars[0].parent?.props.style)).toMatchObject({ width: '100%', justifyContent: 'space-between' })
})

it.each([false, true])('F-02 recovers a conflicted draft after Resume confirms deletion (previously saved: %s)', async (previouslySaved) => {
  if (previouslySaved) mockDrafts = { data: { items: [draft] } }
  mockSave.mockRejectedValueOnce(new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'conflict' }))
  await renderScreen(<ContributionWizard {...props} />)
  if (previouslySaved) await fireEvent.press(button('Tiếp tục bản nháp'))
  else await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Tiếp tục'))
  if (!previouslySaved) await fireEvent.press(button('Sôi động'))
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.changeText(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé'), 'Keep my edited tips')
  await fireEvent.press(button('Lưu nháp'))
  expect(disabled('Lưu nháp')).toBe(true)
  mockRead.mockRejectedValueOnce(new ApiError(404, { code: 'NOT_FOUND', message: 'deleted elsewhere' }))
  await fireEvent.press(button('Tiếp tục bản nháp'))
  expect(disabled('Lưu nháp')).toBe(false)
  expect(screen.queryByText(i18n.t('placeWizard.draft.conflict'))).toBeNull()
  expect(screen.queryByRole('button', { name: 'Tiếp tục bản nháp' })).toBeNull()
  expect(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé').props.value).toBe('Keep my edited tips')
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledTimes(2)
  expect(mockSave.mock.calls[1][0]).toMatchObject({
    body: { expectedVersion: 0, enrichment: { purposeKeys: ['couple'], vibeKeys: ['festive'], visitTips: 'Keep my edited tips' } },
  })
  if (previouslySaved) expect(mockSave.mock.calls[1][0].id).not.toBe(draft.id)
})

it('F-02 retains the conflict guard when Resume fails without confirming deletion', async () => {
  mockSave.mockRejectedValueOnce(new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'conflict' }))
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Lưu nháp'))
  mockRead.mockRejectedValueOnce(new ApiError(503, { code: 'UNAVAILABLE', message: 'offline' }))
  await fireEvent.press(button('Tiếp tục bản nháp'))
  expect(disabled('Lưu nháp')).toBe(true)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledTimes(1)
  expect(button('Tiếp tục bản nháp')).toBeTruthy()
})
