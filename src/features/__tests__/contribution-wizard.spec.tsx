import { StyleSheet } from 'react-native'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import actionMetrics from './fixtures/contribution-action-metrics.json'
import { styles as glassStyles } from '@/shared/ui/glass-bar.style'
import titleMetrics from './fixtures/contribution-title-metrics.json'
import { styles as wizardStyles } from '@/features/place-import/contribution-wizard.style'
import { spacing, type } from '@/shared/ui/tokens'
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
  listContributionDrafts: async () => {
    mockDraftEnabled(true)
    if (mockDrafts.isError) throw mockDrafts.error
    return mockDrafts.data ?? { items: [] }
  },
  getContributionDraft: (id: string) => mockRead(id),
  saveContributionDraft: (id: string, body: unknown) => mockSave({ id, body }),
  deleteContributionDraft: (id: string, version: number) => mockRemove({ id, version }),
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
  mockSave.mockReset(); mockRead.mockReset(); mockRemove.mockReset()
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
  mockSave.mockImplementation(({ id, body }) => Promise.resolve({ ...draft, id, enrichment: body.enrichment, version: body.expectedVersion + 1 }))
  mockRead.mockResolvedValue(draft)
  mockRemove.mockResolvedValue({ deleted: true })
})
const button = (name: string) => screen.getByRole('button', { name })
const disabled = (name: string) => button(name).props.accessibilityState.disabled

it('F-06 conflict -> Start new -> Save keeps the remote row and creates a fresh UUID', async () => {
  mockDrafts.data = { items: [draft] }
  await renderScreen(<ContributionWizard {...props} />)
  expect(disabled('Lưu nháp')).toBe(true)
  await fireEvent.press(button(i18n.t('placeWizard.resume')))
  mockSave.mockRejectedValueOnce(new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'changed' }))
  await fireEvent.press(button('Lưu nháp'))
  await fireEvent.press(button(i18n.t('placeWizard.lifecycle.startNew')))
  expect(screen.getByText(i18n.t('placeWizard.existingDraft'))).toBeTruthy()
  expect(disabled('Lưu nháp')).toBe(false)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledTimes(2)
  const saved = mockSave.mock.calls[1][0]
  expect(saved.id).not.toBe(draft.id)
  expect(saved.body).toEqual({ googlePlaceId: props.googlePlaceId, expectedVersion: 0, enrichment: draft.enrichment })
  expect(mockRemove).not.toHaveBeenCalled()
})

it.each(['deleted', 'absent', 'expired'])('F-06 active draft %s -> Save stays usable with another remote row present', async reason => {
  mockDrafts.data = { items: [draft, { ...draft, id: 'other-draft' }] }
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(screen.getAllByRole('button', { name: i18n.t('placeWizard.resume') })[0])
  if (reason === 'deleted') await fireEvent.press(screen.getAllByRole('button', { name: i18n.t('placeWizard.delete') })[0])
  else {
    mockSave.mockRejectedValueOnce(new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'changed' }))
    await fireEvent.press(button('Lưu nháp'))
    if (reason === 'absent') mockRead.mockRejectedValueOnce(new ApiError(404, { code: 'NOT_FOUND', message: 'missing' }))
    else mockRead.mockResolvedValueOnce({ ...draft, expiresAt: '2020-01-01T00:00:00Z' })
    await fireEvent.press(button(i18n.t('placeWizard.lifecycle.reload')))
  }
  expect(screen.getByText(i18n.t('placeWizard.existingDraft'))).toBeTruthy()
  expect(disabled('Lưu nháp')).toBe(false)
  const previousCalls = mockSave.mock.calls.length
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledTimes(previousCalls + 1)
  expect(mockSave.mock.lastCall[0]).toMatchObject({ id: expect.not.stringMatching(draft.id), body: { expectedVersion: 0, enrichment: draft.enrichment } })
  expect(mockRemove).toHaveBeenCalledTimes(reason === 'deleted' ? 1 : 0)
})

it('starts empty, retains selections back and forth, submits one real enrichment without sample data', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.getByLabelText('+50 GoGo Credit khi được duyệt')).toBeTruthy()
  expect(screen.getByText('+50').props.numberOfLines).toBe(1)
  expect(screen.queryByText('Số dư credit: 123')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  expect(disabled('Tiếp tục')).toBe(true)
  expect(screen.queryByRole('radio')).toBeNull()
  await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Bánh ngon')
  await fireEvent.press(screen.getByRole('radio', { name: 'Phục vụ & không gian: 4 sao' }))
  await fireEvent.press(button('Quay lại'))
  expect(button('Sôi động').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(
    screen.getByRole('checkbox', {
      name: 'Đỗ ô tô',
    }),
  )
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(button('Gửi'))
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
  await fireEvent.press(screen.getByRole('radio', { name: 'Phục vụ & không gian: 4 sao' }))
  await fireEvent.press(button('Yên tĩnh'))
  await fireEvent.press(button('Gửi'))
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
  expect(mockRemove).toHaveBeenCalledWith({ id: draft.id, version: 4 })
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
  mockSave.mockImplementation(({ id, body }) => Promise.resolve({ ...photoDraft, id, version: 4, enrichment: body.enrichment }))
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Tiếp tục bản nháp'))
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Updated tip')
  const enrichment = { ...photoDraft.enrichment, visitTips: 'Updated tip' }
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledWith({
    id: photoDraft.id,
    body: { googlePlaceId: props.googlePlaceId, expectedVersion: 3, enrichment },
  })
  await fireEvent.press(button('Gửi'))
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
    await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Keep my edited tips')
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
      await fireEvent.press(button('Gửi'))
      expect(onSubmit).toHaveBeenCalledWith(enrichment)
    }
    // The stale query cache must not offer to resume the deleted draft or block saving.
    expect(screen.queryByText(i18n.t('placeWizard.existingDraft'))).toBeNull()
  })

  it('retains live photos, consent and draft identity when deletion fails', async () => {
    await resumeAndEdit()
    mockRemove.mockRejectedValueOnce(new ApiError(503, { code: 'UNAVAILABLE', message: 'retry' }))
    await fireEvent.press(button('Xoá bản nháp'))
    const enrichment = { ...photoDraft.enrichment, visitTips: 'Keep my edited tips' }
    await fireEvent.press(button('Gửi'))
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
  expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
})
it('never invokes the picker or submits local photos while the evidence path is blocked', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  const upload = button('+ Tải thêm ảnh menu/bill (Tối đa 5 ảnh)')
  expect(upload.props.accessibilityState.disabled).toBe(true)
  expect(upload.props.accessibilityHint).toMatch(/quyền sở hữu/)
  await fireEvent.press(button('Gửi'))
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
  expect(screen.getAllByRole('button', { name: 'Gửi' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Hoàn tất' })).toBeNull()
  expect(disabled('Gửi')).toBe(false)
  await fireEvent.press(button('Gửi'))
  expect(onSubmit).toHaveBeenCalledTimes(1)
  expect(onSubmit).toHaveBeenCalledWith({ purposeKeys: ['couple'], vibeKeys: ['festive'] })
})
it('allows tips alone, rating alone, and clearing the optional rating without blocking completion', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await completeWizard()
  const tips = screen.getByLabelText('Món ngon & mẹo')
  await fireEvent.changeText(tips, 'Real tip')
  await fireEvent.press(button('Gửi'))
  expect(onSubmit).toHaveBeenLastCalledWith({
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
    visitTips: 'Real tip',
  })
  await fireEvent.changeText(tips, '')
  const star = screen.getByRole('radio', {
    name: 'Phục vụ & không gian: 5 sao',
  })
  await fireEvent.press(star)
  expect(star.props.accessibilityState.checked).toBe(true)
  expect(screen.queryByText('5.0 - Tuyệt vời')).toBeNull()
  await fireEvent.press(button('Gửi'))
  expect(onSubmit).toHaveBeenLastCalledWith({
    purposeKeys: ['couple'],
    vibeKeys: ['festive'],
    service: { rating: 5, chipKeys: [] },
    space: { rating: 5, chipKeys: [] },
  })
  await fireEvent.press(star)
  expect(disabled('Gửi')).toBe(false)
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
  const field = screen.getByLabelText('Món ngon & mẹo')
  expect(field.props.value).toBe('Cake — Morning')
  await fireEvent.press(button('Gửi'))
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
  await fireEvent.press(screen.getByRole('radio', { name: 'Phục vụ & không gian: 5 sao' }))
  expect(screen.queryByText('Đánh giá 6')).toBeNull()
  await fireEvent.press(button('+3 khác'))
  for (const n of [8, 7, 6, 5, 4]) await fireEvent.press(screen.getByRole('checkbox', { name: `Đánh giá ${n}` }))
  expect(screen.getByText('Đã chọn 5/5')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Đánh giá 3' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button('Xong'))
  await fireEvent.press(button('Gửi'))
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
  expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
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
  expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Tiếp tục' })).toHaveLength(1)
  expect(disabled('Tiếp tục')).toBe(true)
  expect(screen.getByLabelText('+50 GoGo Credit khi được duyệt')).toBeTruthy()
  expect(screen.getByText('+50').props.numberOfLines).toBe(1)
  expect(screen.queryByText(/GoGo Credit/)).toBeNull()
  await fireEvent.press(button('Cặp đôi'))
  expect(disabled('Tiếp tục')).toBe(false)
  await fireEvent.press(button('Tiếp tục'))
  expect(disabled('Tiếp tục')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  expect(button('Quay lại')).toBeTruthy()
  await fireEvent.press(button('Sôi động'))
  expect(disabled('Tiếp tục')).toBe(false)
  await fireEvent.press(button('Tiếp tục'))
  const submit = button('Gửi')
  expect(screen.getAllByRole('button', { name: 'Gửi' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
  const save = button('Lưu nháp')
  expect(StyleSheet.flatten(save.props.style)).toMatchObject({ flex: 1, flexBasis: 0, minWidth: 0, minHeight: 48, borderWidth: 1 })
  expect(StyleSheet.flatten(submit.props.style)).toMatchObject({ flex: 1, flexBasis: 0, minWidth: 0, minHeight: 48 })
  expect(within(submit).getByText('Gửi').props.numberOfLines).toBe(1)
  await fireEvent.press(button('Quay lại'))
  expect(button('Sôi động').props.accessibilityState.selected).toBe(true)
  expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  expect(disabled('Tiếp tục')).toBe(false)
})

it.each([404, 503, 0])('offers recovery for draft-list failure %i and allows saving and submission', async (status) => {
  const error = status ? new ApiError(status, { code: 'UNAVAILABLE', message: 'private data' }) : new Error('private data')
  mockDrafts = { isError: true, error }
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.queryByText(/Không thể tải bản nháp/)).toBeNull()
  expect(disabled('Lưu nháp')).toBe(false)
  expect(mockTrack).toHaveBeenCalledWith('place_contribution_draft_read_failed', { operation: 'list', status })
  await completeWizard()
  await fireEvent.press(button('Gửi'))
  expect(onSubmit).toHaveBeenCalled()
  expect(screen.queryByText(/Không lưu được/)).toBeNull()
  mockSave.mockRejectedValue(new ApiError(503, { code: 'UNAVAILABLE', message: 'private data' }))
  await fireEvent.press(button('Lưu nháp'))
  expect(screen.getByText(i18n.t('placeWizard.lifecycle.saveUnconfirmed'))).toBeTruthy()
  expect(disabled('Gửi')).toBe(true)
  expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/private data|ChIJtest/)
})

it.each([404, 503])('silently tolerates resume failure %i without changing entered data or blocking submission', async (status) => {
  mockDrafts = { data: { items: [draft] } }
  mockRead.mockRejectedValue(new ApiError(status, { code: 'UNAVAILABLE', message: 'private data' }))
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Cặp đôi'))
  await fireEvent.press(button('Tiếp tục bản nháp'))
  await fireEvent.press(button('Thay thế thông tin đang nhập'))
  expect(button('Cặp đôi').props.accessibilityState.selected).toBe(true)
  expect(screen.queryByText(i18n.t('placeWizard.draft.failed'))).toBeNull()
  if (status === 404) {
    expect(disabled('Lưu nháp')).toBe(false)
    expect(mockTrack).not.toHaveBeenCalled()
  } else expect(mockTrack).toHaveBeenCalledWith('place_contribution_draft_read_failed', { operation: 'resume', status })
  await fireEvent.press(button('Tiếp tục'))
  await fireEvent.press(button('Sôi động'))
  await fireEvent.press(button('Tiếp tục'))
  expect(disabled('Gửi')).toBe(false)
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
  await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Keep my edited tips')
  await fireEvent.press(button('Lưu nháp'))
  expect(disabled('Lưu nháp')).toBe(true)
  mockRead.mockRejectedValueOnce(new ApiError(404, { code: 'NOT_FOUND', message: 'deleted elsewhere' }))
  await fireEvent.press(button('Tải bản mới nhất'))
  const confirm = screen.queryByRole('button', { name: 'Thay thế thông tin đang nhập' })
  if (confirm) await fireEvent.press(confirm)
  expect(disabled('Lưu nháp')).toBe(false)
  expect(screen.queryByText(i18n.t('placeWizard.draft.conflict'))).toBeNull()
  expect(screen.queryByRole('button', { name: 'Tiếp tục bản nháp' })).toBeNull()
  expect(screen.getByLabelText('Món ngon & mẹo').props.value).toBe('Keep my edited tips')
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
  await fireEvent.press(button('Tải bản mới nhất'))
  const confirm = screen.queryByRole('button', { name: 'Thay thế thông tin đang nhập' })
  if (confirm) await fireEvent.press(confirm)
  expect(disabled('Lưu nháp')).toBe(true)
  await fireEvent.press(button('Lưu nháp'))
  expect(mockSave).toHaveBeenCalledTimes(1)
  expect(button('Tải bản mới nhất')).toBeTruthy()
})

// SA lifecycle matrix: public UI regression probes, also run unchanged on b4ca8b3.
describe('SA T1-T12 lifecycle regressions', () => {
  const photos = [{ mediaId: 'menu', kind: 'menu' as const }, { mediaId: 'bill', kind: 'bill' as const }]
  const photoDraft = { ...draft, enrichment: { ...draft.enrichment, photos, billPhotoPublicConsent: true } }
  async function resumePhoto() {
    mockDrafts = { data: { items: [photoDraft] } }
    mockRead.mockResolvedValue(photoDraft)
    await renderScreen(<ContributionWizard {...props} />)
    await fireEvent.press(button('Tiếp tục bản nháp'))
  }
  it('M02 blocks bill writes without explicit acknowledgement and offers local removal', async () => {
    mockDrafts = { data: { items: [photoDraft] } }
    mockRead.mockResolvedValue({ ...photoDraft, enrichment: { ...photoDraft.enrichment, billPhotoPublicConsent: undefined } })
    await renderScreen(<ContributionWizard {...props} />)
    await fireEvent.press(button('Tiếp tục bản nháp'))
    expect(disabled('Lưu nháp')).toBe(true)
    await fireEvent.press(button('Xoá ảnh hoá đơn'))
    await fireEvent.press(button('Lưu nháp'))
    expect(mockSave.mock.calls[0][0].body.enrichment.photos).toEqual([photos[0]])
    expect(mockSave.mock.calls[0][0].body.enrichment).not.toHaveProperty('billPhotoPublicConsent')
  })
  it('M03 confirmed active absence detaches media, consent, identity and conflict together', async () => {
    await resumePhoto()
    mockSave.mockRejectedValueOnce(new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'changed' }))
    await fireEvent.press(button('Lưu nháp'))
    mockRead.mockRejectedValueOnce(new ApiError(404, { code: 'NOT_FOUND', message: 'gone' }))
    await fireEvent.press(screen.queryByRole('button', { name: 'Tải bản mới nhất' }) ?? button('Tiếp tục bản nháp'))
    const confirm = screen.queryByRole('button', { name: 'Thay thế thông tin đang nhập' })
    if (confirm) await fireEvent.press(confirm)
    await fireEvent.press(button('Lưu nháp'))
    const saved = mockSave.mock.calls[1][0]
    expect(saved.id).not.toBe(draft.id)
    expect(saved.body).toEqual({ googlePlaceId: props.googlePlaceId, expectedVersion: 0, enrichment: draft.enrichment })
  })
  it('M04 another missing row cannot detach the active media or consent', async () => {
    const other = { ...draft, id: 'other' }
    mockDrafts = { data: { items: [photoDraft, other] } }
    mockRead.mockResolvedValueOnce(photoDraft)
    await renderScreen(<ContributionWizard {...props} />)
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tiếp tục bản nháp' })[0])
    mockRead.mockRejectedValueOnce(new ApiError(404, { code: 'NOT_FOUND', message: 'gone' }))
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tiếp tục bản nháp' })[1])
    await fireEvent.press(button('Tiếp tục')); await fireEvent.press(button('Tiếp tục'))
    await fireEvent.press(button('Gửi'))
    expect(onSubmit).toHaveBeenCalledWith(photoDraft.enrichment)
    expect(mockRead).toHaveBeenLastCalledWith('other')
  })
  it('M05 deleting another row preserves active media; deleting active detaches all media/consent', async () => {
    mockDrafts = { data: { items: [photoDraft, { ...draft, id: 'other' }] } }
    mockRead.mockResolvedValue(photoDraft)
    await renderScreen(<ContributionWizard {...props} />)
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tiếp tục bản nháp' })[0])
    await fireEvent.press(screen.getAllByRole('button', { name: 'Xoá bản nháp' })[1])
    await fireEvent.press(button('Tiếp tục')); await fireEvent.press(button('Tiếp tục'))
    await fireEvent.press(button('Gửi'))
    expect(onSubmit).toHaveBeenLastCalledWith(photoDraft.enrichment)
    await fireEvent.press(button('Xoá bản nháp'))
    await fireEvent.press(button('Gửi'))
    expect(onSubmit).toHaveBeenLastCalledWith(draft.enrichment)
    expect(mockRemove.mock.calls).toEqual([[{ id: 'other', version: 3 }], [{ id: draft.id, version: 3 }]])
  })
  it('M06 DELETE 404 reconciles via GET and requires explicit review of a newer version', async () => {
    await resumePhoto()
    mockRemove.mockRejectedValueOnce(new ApiError(404, { code: 'NOT_FOUND', message: 'version mismatch' }))
    mockRead.mockResolvedValue({ ...photoDraft, version: 4 })
    await fireEvent.press(button('Xoá bản nháp'))
    expect(mockRead).toHaveBeenCalledTimes(2)
    expect(disabled('Lưu nháp')).toBe(true)
    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(button('Tải bản mới nhất')).toBeTruthy()
  })
  it('M07 active expiry clears media and retains recovery without list membership', async () => {
    mockDrafts = { data: { items: [photoDraft] } }
    mockRead.mockResolvedValue({ ...photoDraft, expiresAt: '2020-01-01T00:00:00Z' })
    await renderScreen(<ContributionWizard {...props} />)
    await fireEvent.press(button('Tiếp tục bản nháp'))
    await fireEvent.press(button('Lưu nháp'))
    expect(mockSave.mock.calls[0][0].body.expectedVersion).toBe(0)
    expect(mockSave.mock.calls[0][0].body.enrichment).not.toHaveProperty('photos')
  })
  it('M08 conflict quarantines writes and offers detach without remote deletion', async () => {
    await resumePhoto()
    mockSave.mockRejectedValueOnce(new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'changed' }))
    await fireEvent.press(button('Lưu nháp'))
    await fireEvent.press(button('Tiếp tục'))
    await fireEvent.press(button('Tiếp tục'))
    expect(disabled('Gửi')).toBe(true)
    await fireEvent.press(button('Tạo bản mới với thông tin khác của tôi'))
    await fireEvent.press(button('Gửi'))
    expect(onSubmit).toHaveBeenCalledWith(draft.enrichment)
    expect(mockRemove).not.toHaveBeenCalled()
  })
  it.each(['INVALID_SUBMISSION_PHOTOS', 'INVALID_UPLOAD_KEY'])('M09 %s clears rejected media and offers working recovery', async (code) => {
    await resumePhoto()
    mockSave.mockRejectedValueOnce(new ApiError(400, { code, message: 'bad media' }))
    await fireEvent.press(button('Lưu nháp'))
    const recovery = screen.queryByRole('button', { name: 'Tiếp tục không có ảnh' })
    if (recovery) await fireEvent.press(recovery)
    await fireEvent.press(button('Lưu nháp'))
    expect(mockSave.mock.calls[1][0].body.enrichment).toEqual(draft.enrichment)
  })
  it('M10 uncertain create is read by the SAME UUID before another write', async () => {
    mockSave.mockRejectedValueOnce(new Error('response lost after commit'))
    await renderScreen(<ContributionWizard {...props} />)
    await fireEvent.press(button('Lưu nháp'))
    const id = mockSave.mock.calls[0][0].id
    mockRead.mockResolvedValue({ ...draft, id, version: 1, enrichment: {} })
    await fireEvent.press(button('Lưu nháp'))
    expect(mockRead).toHaveBeenCalledWith(id)
    expect(mockSave).toHaveBeenCalledTimes(1)
  })
  it('F-09 uncertain save preserves the controlled text and removed bills; reload visibly asks before replacement', async () => {
    await resumePhoto(); await fireEvent.press(button('Tiếp tục')); await fireEvent.press(button('Tiếp tục'))
    mockSave.mockRejectedValueOnce(new Error('response lost after commit'))
    await fireEvent.press(button('Lưu nháp'))
    const frozen = mockSave.mock.calls[0][0].body.enrichment
    await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Later tips')
    await fireEvent.press(button(i18n.t('placeWizard.lifecycle.removeBills')))
    mockRead.mockResolvedValue({ ...photoDraft, version: 4, enrichment: frozen })
    await fireEvent.press(button(i18n.t('placeWizard.lifecycle.checkSave')))
    expect(screen.getByLabelText('Món ngon & mẹo').props.value).toBe('Later tips')
    expect(screen.queryByRole('button', { name: i18n.t('placeWizard.lifecycle.removeBills') })).toBeNull()
    await fireEvent.press(button('Tiếp tục bản nháp'))
    expect(screen.getByText(i18n.t('placeWizard.lifecycle.replaceConfirmation'))).toBeTruthy()
    expect(mockRead).toHaveBeenCalledTimes(2)
    await fireEvent.press(button(i18n.t('common.cancel')))
    await fireEvent.press(button('Lưu nháp'))
    expect(mockSave.mock.calls[1][0].body).toMatchObject({ expectedVersion: 4, enrichment: { visitTips: 'Later tips', photos: [{ mediaId: 'menu', kind: 'menu' }] } })
    expect(mockSave.mock.calls[1][0].body.enrichment).not.toHaveProperty('billPhotoPublicConsent')
  })
  it('M15 list errors show localized retry while preserving usable inputs', async () => {
    mockDrafts = { isError: true, error: new ApiError(404, { code: 'NOT_FOUND', message: 'route unavailable' }) }
    await renderScreen(<ContributionWizard {...props} />)
    expect(screen.getByText(i18n.t('placeWizard.lifecycle.draftListUnavailable'))).toBeTruthy()
    expect(button('Thử tải danh sách nháp lại')).toBeTruthy()
    expect(disabled('Lưu nháp')).toBe(false)
  })
})

// CoreText CTLineGetTypographicBounds, bundled Inter SemiBold 17pt / Regular 11pt,
// rounded UP to 0.01pt. Exact copy + font hashes prevent stale measurements passing.
// Captions/chips sit below titles, so none consumes the title's horizontal budget.
describe('GOGO-566 one-line titles at 390pt', () => {
  it('keeps the measured font faces unchanged', () => {
    for (const [face, hash] of Object.entries(titleMetrics.fonts)) {
      expect(createHash('sha256').update(readFileSync(`assets/fonts/Inter-${face}.ttf`)).digest('hex')).toBe(hash)
    }
    expect(type.introHeading.fontSize).toBe(17)
    expect(type.introCaption.fontSize).toBe(11)
  })

  it.each(['vi', 'en'])('%s copy stays within measured width and string-length budgets', locale => {
    const card = StyleSheet.flatten(wizardStyles.card)
    const body = StyleSheet.flatten(wizardStyles.body)
    const heading = StyleSheet.flatten(wizardStyles.heading)
    const content = 390 - 2 * spacing[4] - 2 * card.borderWidth - 2 * body.padding
    for (const [id, measurement] of Object.entries(titleMetrics.titles)) {
      if (!id.startsWith(`${locale}.`)) continue
      const key = id.slice(3)
      const progress = key.startsWith('step')
      const stepHeading = key.startsWith('heading')
      const budget = progress
        ? (content - 2 * StyleSheet.flatten(wizardStyles.progress).gap) / 3
        : content - (stepHeading ? StyleSheet.flatten(wizardStyles.stepNumber).minWidth : 18) - heading.gap
      const title = i18n.t(`placeWizard.${key}`, { lng: locale })
      expect(title).toBe(measurement.text)
      // Copy length guard in addition to font measurement (21/18 chars measured
      // for the longest heading/progress title; no ellipsis needed at 390pt).
      expect([...title].length).toBeLessThanOrEqual(progress ? 18 : 21)
      expect(measurement.width).toBeLessThanOrEqual(budget)
    }
  })

  it.each(['vi', 'en'])('%s renders every section and step title on one line', async locale => {
    await i18n.changeLanguage(locale)
    await renderScreen(<ContributionWizard {...props} />)
    const sections = [
      [['price', 'payments'], ['purposes', 'target']],
      [['vibes', 'mood'], ['amenities', 'activity']],
      [['photos', 'receipt'], ['tipsHeading', 'tips'], ['ratings', 'reviews']],
    ]
    for (let step = 1; step <= 3; step++) {
      const title = screen.getByTestId('contribution-step-title')
      expect(title.props.numberOfLines).toBe(1)
      expect(title).toHaveTextContent(i18n.t(`placeWizard.heading${step}`))
      expect(StyleSheet.flatten(title.parent?.props.style)).toMatchObject({ minWidth: 0, alignItems: 'flex-start' })
      for (const [key, icon] of sections[step - 1]) {
        const section = screen.getByTestId(`contribution-section-title-${icon}`)
        expect(section.props.numberOfLines).toBe(1)
        expect(section).toHaveTextContent(i18n.t(`placeWizard.${key}`))
        expect(StyleSheet.flatten(section.parent?.props.style)).toMatchObject({ minWidth: 0, alignItems: 'flex-start' })
      }
      for (let n = 1; n <= 3; n++) expect(screen.getByTestId(`contribution-progress-title-${n}`).props.numberOfLines).toBe(1)
      if (step < 3) {
        await fireEvent.press(button(locale === 'vi' ? step === 1 ? 'Cặp đôi' : 'Sôi động' : step === 1 ? 'Couple' : 'Festive'))
        await fireEvent.press(button(i18n.t('placeWizard.next')))
      }
    }
  })
})

// CoreText widths, Inter SemiBold 15pt, rounded up to 0.01pt.
// Jest has no Yoga/text layout: guard exact copy, font and rendered geometry together.
describe('GOGO-566 action labels without truncation', () => {
  it('pins the measured button font', () => {
    expect(createHash('sha256').update(readFileSync('assets/fonts/Inter-SemiBold.ttf')).digest('hex')).toBe(actionMetrics.fontSha256)
    expect(type.buttonLabel.fontSize).toBe(actionMetrics.fontSize)
    expect(type.buttonLabel.fontFamily).toBe(type.introHeading.fontFamily)
  })

  it.each(['vi', 'en'] as const)('%s fits every step at 390pt and SE widths', async locale => {
    await i18n.changeLanguage(locale)
    await renderScreen(<ContributionWizard {...props} />)
    const measurements = actionMetrics.labels[locale]
    for (let step = 1; step <= 3; step++) {
      const row = within(screen.getByTestId('contribution-action-bar')).getByTestId('sheet-actions')
      const rowStyle = StyleSheet.flatten(row.props.style)
      const keys = [...(step > 1 ? ['common.back' as const] : []), 'placeWizard.save' as const,
        step < 3 ? 'placeWizard.next' as const : 'placeImport.submit' as const]
      const actions = within(row).getAllByRole('button')
      expect(actions).toHaveLength(keys.length)
      for (const [index, key] of keys.entries()) {
        const measurement = measurements[key]
        const action = actions[index]
        const style = StyleSheet.flatten(action.props.style)
        expect(action.props.accessibilityLabel).toBe(measurement.text)
        expect(i18n.t(key)).toBe(measurement.text)
        expect([...measurement.text].length).toBeLessThanOrEqual(10)
        expect(style).toMatchObject({ flex: 1, flexBasis: 0, minWidth: 0, minHeight: 48 })
        expect(within(action).getByText(measurement.text).props.numberOfLines).toBe(1)
        expect(within(action).queryByTestId(/^material-icon-/)).toBeNull()
        for (const width of [320, 375, 390]) {
          const buttonWidth = (width - 2 * glassStyles.padded.paddingHorizontal - rowStyle.gap * (actions.length - 1)) / actions.length
          const labelWidth = buttonWidth - 2 * style.paddingHorizontal - 2 * (style.borderWidth ?? 0)
          expect(measurement.width).toBeLessThanOrEqual(labelWidth)
        }
      }
      if (step === 1) await fireEvent.press(button(locale === 'vi' ? 'Cặp đôi' : 'Couple'))
      if (step === 2) await fireEvent.press(button(locale === 'vi' ? 'Sôi động' : 'Festive'))
      if (step < 3) await fireEvent.press(button(i18n.t('placeWizard.next')))
    }
  })
})
