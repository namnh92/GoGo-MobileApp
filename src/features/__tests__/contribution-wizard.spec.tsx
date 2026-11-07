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
  expect(button('Sôi động náo nhiệt').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(
    screen.getByRole('checkbox', {
      name: 'Chỗ đỗ ô tô thuận tiện (Google Maps hay thiếu)',
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
it('renders only mapped Stitch options, with checklist rows rather than extra taxonomy chips', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  expect(screen.queryByText('Sống ảo check-in')).toBeNull()
  await fireEvent.press(button('Hẹn hò lãng mạn'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  expect(screen.queryByText('Thư giãn')).toBeNull()
  expect(screen.queryByText('Wi-Fi')).toBeNull()
  expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  expect(
    screen.queryByRole('button', {
      name: 'Cho phép mang thú cưng (Pet-friendly)',
    }),
  ).toBeNull()
  expect(button('Sôi động náo nhiệt')).toBeTruthy()
  expect(screen.queryByText('Yên tĩnh riêng tư')).toBeNull()
  await fireEvent.press(button('Sôi động náo nhiệt'))
  await fireEvent.press(button('Tiếp tục sang Bước 3'))
  expect(screen.getAllByRole('radio')).toHaveLength(5)
  expect(screen.queryByText('Nhân viên thân thiện')).toBeNull()
  expect(screen.queryByText('Yên tĩnh')).toBeNull()
  expect(screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé')).toBeTruthy()
  expect(screen.queryByLabelText('Món ngon phải thử (không bắt buộc)')).toBeNull()
  expect(screen.queryByLabelText('Mẹo khi ghé (không bắt buộc)')).toBeNull()
})
it('keeps price with unit and rejects malformed, reversed and unbounded ranges', async () => {
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Hẹn hò lãng mạn'))
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
  await fireEvent.press(button('Hẹn hò lãng mạn'))
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
  expect(button('Hẹn hò lãng mạn').props.accessibilityState.selected).toBe(true)
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
it('uses localized Stitch labels for mapped API keys and hides unrelated or unlabelled options', async () => {
  await i18n.changeLanguage('en')
  mockTaxonomies = {
    data: {
      kinds: {
        ...contributionTaxonomies.kinds,
        suitability: [
          { key: 'couple', labels: { en: 'Couple', vi: 'Cặp đôi' } },
          { key: 'group' },
          { key: 'new_kind', labels: { en: 'New occasion', vi: 'Dịp mới' } },
          { key: 'missing_label' },
        ],
      },
    },
  }
  await renderScreen(<ContributionWizard {...props} />)
  expect(button('Romantic date')).toBeTruthy()
  expect(screen.queryByText('Meet friends')).toBeNull()
  expect(screen.queryByText('New occasion')).toBeNull()
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
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  await fireEvent.press(button('Tiếp tục sang Bước 3'))
  const field = screen.getByLabelText('Món ngon phải thử & Mẹo khi ghé')
  expect(field.props.value).toBe('Cake — Morning')
  expect(disabled('Hoàn tất')).toBe(false)
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
it('renders all six contract-backed amenities in Stitch order when the API exposes them', async () => {
  const keys = [
    'car_parking',
    'power_at_each_table',
    'pets_allowed',
    'separate_smoking_area',
    'open_after_23',
    'tables_over_six',
  ]
  mockTaxonomies = {
    data: {
      kinds: {
        ...contributionTaxonomies.kinds,
        amenity: keys
          .slice()
          .reverse()
          .map((key) => ({ key, labels: { vi: key } })),
      },
    },
  }
  await renderScreen(<ContributionWizard {...props} />)
  await fireEvent.press(button('Hẹn hò lãng mạn'))
  await fireEvent.press(button('Tiếp tục sang Bước 2'))
  expect(screen.getAllByRole('checkbox').map((row) => row.props.accessibilityLabel)).toEqual([
    'Chỗ đỗ ô tô thuận tiện (Google Maps hay thiếu)',
    'Ổ cắm điện từng bàn (tiện làm việc)',
    'Cho phép mang thú cưng (Pet-friendly)',
    'Khu vực hút thuốc riêng biệt',
    'Mở thâu đêm / sau 23h',
    'Có bàn lớn cho nhóm >6 người',
  ])
})
