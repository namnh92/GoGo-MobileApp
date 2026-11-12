import { render } from './query-render'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent,  screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles'
import { themes, type AppTheme } from '@/shared/ui/theme'

import type { PlaceCard as PlaceCardModel } from '@/shared/api'
import i18n from '@/shared/i18n'
import { PlaceCardLarge as PlaceCard } from '@/shared/ui/place-card-large.view'
import { PlaceCardSmall } from '@/shared/ui/place-card-small.view'
import { type } from '@/shared/ui/tokens'

let mockRealAdministrative = false
let mockProvinces: { code: string; fullName: string; nameEn?: string }[] = []
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => mockRealAdministrative ? jest.requireActual('@/shared/administrative/queries').useAdministrativeVersion() : ({ data: { datasetVersion: '2026-11' } }),
  useAdministrativeUnits: (version: string) => mockRealAdministrative ? jest.requireActual('@/shared/administrative/queries').useAdministrativeUnits(version) : ({ data: mockProvinces }),
}))
beforeEach(() => { mockProvinces = [{ code: '79', fullName: 'Thành phố Hồ Chí Minh', nameEn: 'Ho Chi Minh City' }]; mockRealAdministrative = false })

/**
 * #295 — the list PlaceCard per #293 §3 and the owner decisions of 2026-09-24
 * (visible source marks superseded by owner decision 2026-11-07).
 *
 * jest has no layout engine, so "fits at 375 and 402pt" is measured on a
 * device. Source marks wrap with the rating; address and name have their own
 * line limits.
 */
const fixture = (overrides: Partial<PlaceCardModel> = {}): PlaceCardModel => ({
  id: 'p1',
  name: 'Cà phê Đỗ Phủ',
  addressText: '12 Nguyễn Huệ',
  distanceM: 2100,
  rating: 4.6,
  ratingCount: 980,
  priceMin: 45000,
  priceMax: 90000,
  currency: 'VND',
  priceUncertain: false,
  priceUnit: 'per_person',
  openNow: true,
  closesAtMinute: 1200,
  isLodging: false,
  reasonCodes: [],
  photoUrl: null,
  photoAttribution: 'Ảnh: Google Maps',
  ...overrides,
}) as PlaceCardModel

const flat = (id: string): Record<string, any> => StyleSheet.flatten(screen.getByTestId(id).props.style)
describe('one shared PlaceCard', () => {
  it.each(['default', 'discovery', 'saved'] as const)('%s renders the same place facts', async () => {
    await render(<PlaceCard place={fixture({ gogoRating: 4.8, gogoRatingCount: 20, discovery: { categoryLabel: 'Cà phê' } })} tags={['Wi-Fi', 'Làm việc', 'Siphon']} />)
    expect(screen.getByTestId('place-card-address-row')).toBeTruthy()
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent('12 Nguyễn Huệ')
    expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(screen.getByText('★ 4,8 (20) GoGo')).toBeTruthy()
    expect(screen.getByTestId('place-card-price')).toHaveTextContent('45k–90k/người')
    expect(screen.getByText('Mở đến 20:00')).toBeTruthy()
    expect(screen.getByText('Cà phê')).toBeTruthy()
    expect(screen.getByText('Siphon')).toBeTruthy()
    expect(flat('place-card-surface')).toMatchObject({ backgroundColor: themes.orange.surface.card, borderRadius: 20, overflow: 'hidden' })
  })
  it.each(['list', 'hero', 'compact'] as const)('%s preserves separate sources, sample sizes and address', async () => {
    await render(<PlaceCard place={fixture({ gogoRating: 4.9, gogoRatingCount: 4 })} />)
    expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(screen.getByText('GoGo · Chưa đủ đánh giá (4)')).toBeTruthy()
    expect(screen.queryByText(/4,9/)).toBeNull()
    expect(screen.getByTestId('place-card-meta').props.numberOfLines).toBe(2)
  })
  it('omits missing facts, unknown price and guest actions', async () => {
    await render(<PlaceCard place={fixture({ addressText: undefined, rating: undefined, ratingCount: undefined, openNow: undefined, distanceM: undefined, priceMin: null, priceMax: null })} />)
    for (const id of ['place-card-meta', 'place-google-rating', 'place-gogo-rating', 'place-card-price', 'place-card-photo-badges', 'place-card-save']) expect(screen.queryByTestId(id)).toBeNull()
  })
  it('shows a source without empty parentheses when sample size is unknown', async () => {
    await render(<PlaceCard place={fixture({ ratingCount: undefined, priceUnit: 'free' })} />)
    expect(screen.getByText('★ 4,6 Google')).toBeTruthy()
    expect(screen.getByTestId('place-card-price')).toHaveTextContent('Miễn phí')
  })
  it('formats English independently for each source', async () => {
    await act(async () => { await i18n.changeLanguage('en') })
    try {
      await render(<PlaceCard place={fixture({ ratingCount: 1234, gogoRating: 4.9, gogoRatingCount: 50 })} />)
      expect(screen.getByText('★ 4.6 (1,234) Google')).toBeTruthy()
      expect(screen.getByText('★ 4.9 (50) GoGo')).toBeTruthy()
    } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
  })
  it('save remains an independent accessible 44pt action', async () => {
    const onPress = jest.fn(); const onToggle = jest.fn()
    await render(<PlaceCard place={fixture()} onPress={onPress} saved onToggleSave={onToggle} />)
    const target = screen.getByTestId('place-card-open-target')
    const toggle = screen.getByTestId('place-card-save')
    expect(flat('place-card-save')).toMatchObject({ width: 44, height: 44 })
    expect(toggle.props.accessibilityState.checked).toBe(true)
    let parent = toggle.parent
    while (parent) { expect(parent).not.toBe(target); parent = parent.parent }
    await fireEvent.press(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })
  it('preserves provider attribution and author links', async () => {
    await render(<PlaceCard place={fixture({ photoSource: 'google', photoAuthors: [{ displayName: 'Author', uri: 'https://example.com', photoUri: null }] })} />)
    expect(screen.getByTestId('saved-photo-attribution')).toHaveTextContent(/Google.*Author/)
    expect(screen.getByRole('link')).toBeTruthy()
  })
})

describe('shared address and rating behavior', () => {
  const areaSummary: NonNullable<PlaceCardModel['areaSummary']> = {
    datasetVersion: '2026-11', provinceCode: '79', communeCode: '26740',
    label: 'Phường Sài Gòn', locale: 'vi',
  }

  it.each([
    ['12 Nguyễn Huệ', '12 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh'],
    [undefined, 'Sài Gòn, Hồ Chí Minh'],
    ['', 'Sài Gòn, Hồ Chí Minh'],
  ] as const)('renders address %s with matching accessibility text', async (addressText, expected) => {
    await render(<PlaceCard place={fixture({ addressText, areaSummary, discovery: { areaLabel: 'Discovery bucket' } })} />)
    const line = screen.getByTestId('place-card-meta')
    expect(line).toHaveTextContent(expected, { exact: true })
    expect(line.props.numberOfLines).toBe(2)
    expect(line.props.accessibilityLabel).toBe(expected)
    expect(flat('place-card-meta')).toMatchObject({ ...type.introSmall, color: themes.orange.text.secondary })
  })

  it('omits the address line without either fact instead of using the chip or area key', async () => {
    await render(<PlaceCard place={fixture({ addressText: undefined, areaKey: 'hcm_q3', discovery: { areaLabel: 'Discovery bucket' } })} />)
    expect(screen.queryByTestId('place-card-meta')).toBeNull()
    expect(screen.queryByLabelText('Discovery bucket')).toBeNull()
  })

  it('keeps the proper name when the label locale differs from the app language', async () => {
    await act(async () => { await i18n.changeLanguage('en') })
    try {
      await render(<PlaceCard place={fixture({ addressText: undefined, areaSummary })} />)
      expect(screen.getByTestId('place-card-meta')).toHaveTextContent('Sài Gòn, Hồ Chí Minh', { exact: true })
      expect(screen.getByLabelText('Sài Gòn, Hồ Chí Minh')).toBeTruthy()
    } finally {
      await act(async () => { await i18n.changeLanguage('vi') })
    }
  })

  it('renders separate rating sources and isolates save from open', async () => {
    const open = jest.fn(); const save = jest.fn()
    await render(<PlaceCard place={fixture({ gogoRating: 4.9, gogoRatingCount: 20 })} saved onPress={open} onToggleSave={save} />)
    expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(screen.getByText('★ 4,9 (20) GoGo')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('place-card-save'))
    expect(save).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })
  it.each([0, 4])('hides a community score below five reviews (%i)', async count => {
    await render(<PlaceCard place={fixture({ gogoRating: 4.9, gogoRatingCount: count })} />)
    expect(screen.queryByText(/4,9/)).toBeNull()
    expect(screen.getByText(`GoGo · Chưa đủ đánh giá (${count})`)).toBeTruthy()
    expect(screen.queryByTestId('place-card-save')).toBeNull()
  })
  it('keeps the default Saved card layout and remove toggle when new facts exist', async () => {
    const remove = jest.fn()
    await render(<PlaceCard place={fixture({ gogoRating: 4.9, gogoRatingCount: 20, priceMin: null, priceMax: null, priceUnit: 'unknown', openNow: undefined })} saved onToggleSave={remove} />)
    expect(screen.getByTestId('place-card')).toBeTruthy()
    expect(screen.queryByTestId('place-card-discovery')).toBeNull()
    expect(screen.queryByText('Chưa có thông tin giá')).toBeNull()
    await fireEvent.press(screen.getByTestId('place-card-save'))
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

/** Structural evidence only: RNTL/Jest do not perform Yoga text measurement. */
describe('#515 shared discovery card address', () => {
  it.each([
    ['12 Nguyễn Huệ', '12 Nguyễn Huệ, Quận 1, Hồ Chí Minh'],
    [undefined, 'Quận 1, Hồ Chí Minh'],
    ['  ', 'Quận 1, Hồ Chí Minh'],
  ])('appends the real ward to the street (%s)', async (addressText, expected) => {
    await render(<PlaceCard place={fixture({ addressText, areaSummary: { datasetVersion: '2026-11', provinceCode: '79', communeCode: '26740', label: 'Quận 1', locale: 'vi' }, discovery: { areaLabel: 'Discovery bucket' } })} />)
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent(expected!, { exact: true })
    expect(screen.getByTestId('place-card-meta').props.numberOfLines).toBe(2)
    expect(screen.getByTestId('place-card-meta').props.ellipsizeMode).toBe('tail')
    expect(screen.getByTestId('place-card-meta').props.accessibilityLabel).toBe(expected)
    expect(screen.getByTestId('place-card-name').props.numberOfLines).toBe(1)
    expect(screen.getByTestId('place-card-name').props.ellipsizeMode).toBe('tail')
  })
  it('omits address and overlays without facts, and unknown price', async () => {
    await render(<PlaceCard place={fixture({ addressText: undefined, distanceM: undefined, rating: undefined, ratingCount: undefined, openNow: undefined, priceMin: null, priceMax: null, priceUnit: 'unknown', photoAttribution: null })} />)
    expect(screen.queryByTestId('place-card-meta')).toBeNull()
    expect(screen.queryByTestId('place-card-photo-badges')).toBeNull()
    expect(screen.queryByText(/Google|GoGo|Xác minh/)).toBeNull()
    expect(screen.queryByText('Chưa có thông tin giá')).toBeNull()
  })
})

describe('owner address composition everywhere', () => {
  const areaSummary = { datasetVersion: '2026-11', provinceCode: '79', communeCode: '26740', label: 'Phường Sài Gòn', locale: 'vi' as const }
  it.each([
    ['default', 'list', '8 P. Chân Cầm, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '8 P. Chân Cầm, Hoàn Kiếm, Hà Nội'],
    ['discovery', 'list', '24 P. Đường Thành, Phố cổ Hà Nội, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '24 P. Đường Thành, Hoàn Kiếm, Hà Nội'],
    ['default', 'hero', '79 P. Lý Nam Đế, phường, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '79 P. Lý Nam Đế, Hoàn Kiếm, Hà Nội'],
    ['discovery', 'hero', '43 Tràng Tiền', 'Cửa Nam', '43 Tràng Tiền, Cửa Nam, Hà Nội'],
  ] as const)('normalizes the owner example for %s/%s', async (_appearance, _variant, addressText, label, expected) => {
    mockProvinces = [{ code: '01', fullName: 'Thành phố Hà Nội' }]
    await render(<PlaceCard place={fixture({
      addressText, areaSummary: { ...areaSummary, provinceCode: '01', label },
    })} />)
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent(expected, { exact: true })
    expect(screen.getByTestId('place-card-meta').props.accessibilityLabel).toBe(expected)
  })
  it.each([
    ['default', 'list'], ['discovery', 'list'], ['default', 'hero'],
  ] as const)('composes street, ward and cached province for %s/%s', async () => {
    mockProvinces = [{ code: '79', fullName: 'Thành phố Hồ Chí Minh' }]
    await render(<PlaceCard place={fixture({ areaSummary })} />)
    const expected = '12 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh'
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent(expected, { exact: true })
    expect(screen.getByTestId('place-card-meta').props.accessibilityLabel).toBe(expected)
  })
  it.each([
    ['12 Nguyen Hue, PHUONG SAI GON, THANH PHO HO CHI MINH', '26740', '12 Nguyen Hue, Sài Gòn, Hồ Chí Minh'],
    [undefined, null, undefined],
    [undefined, '26740', 'Sài Gòn, Hồ Chí Minh'],
    [' 12 Nguyễn Huệ ', null, ' 12 Nguyễn Huệ '],
  ])('skips duplicates and missing ward (%s/%s)', async (addressText, communeCode, expected) => {
    mockProvinces = [{ code: '79', fullName: 'Thành phố Hồ Chí Minh' }]
    await render(<PlaceCard place={fixture({ addressText: addressText ?? undefined, areaSummary: { ...areaSummary, communeCode } })} />)
    if (expected === undefined) expect(screen.queryByTestId('place-card-meta')).toBeNull()
    else {
      expect(screen.getByTestId('place-card-meta')).toHaveTextContent(expected.trim(), { exact: true })
      expect(screen.getByTestId('place-card-meta').props.accessibilityLabel).toBe(expected)
    }
  })
  it('omits the row when all address facts are absent', async () => {
    await render(<PlaceCard place={fixture({ addressText: ' ', areaSummary: { ...areaSummary, communeCode: null } })} />)
    expect(screen.queryByTestId('place-card-meta')).toBeNull()
  })
  it('keeps a closed status in one pill without a location chip', async () => {
    await render(<PlaceCard place={fixture({ openNow: false, opensAtMinute: 450, opensDayOffset: 1, discovery: { areaLabel: 'Phường Sài Gòn' } })} />)
    expect(screen.getByText('Đã đóng · Mở 07:30 ngày mai').props.numberOfLines).toBeUndefined()
    expect(screen.queryByTestId('place-card-area-badge')).toBeNull()
  })
})

it('shares the existing provinces cache across cards without another network read', async () => {
  mockRealAdministrative = true
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['administrative', 'version'], { datasetVersion: '2026-11' })
  client.setQueryData(['administrative', '2026-11', 'provinces'], [{ code: '79', fullName: 'Thành phố Hồ Chí Minh' }])
  const fetch = jest.spyOn(globalThis, 'fetch')
  try {
    const place = fixture({ areaSummary: { datasetVersion: '2026-11', provinceCode: '79', communeCode: '26740', label: 'Phường Sài Gòn', locale: 'vi' } })
    const view = await render(<QueryClientProvider client={client}><PlaceCard place={place} /><PlaceCard place={place} /></QueryClientProvider>)
    expect(screen.getAllByLabelText('12 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh')).toHaveLength(2)
    expect(fetch).not.toHaveBeenCalled()
    await view.unmount()
  } finally {
    fetch.mockRestore()
    client.clear()
  }
})

describe('g04 Saved reference card', () => {
  it.each(['orange', 'orangeDark'] as const)('keeps units, two rating sources, CMS tags and source credits (%s)', async themeName => {
    const create = jest.spyOn(UnistylesStyleSheet, 'create')
    jest.isolateModules(() => { jest.requireActual('../place-card.style') })
    const factory = create.mock.calls[0][0] as (theme: AppTheme) => Record<string, any>
    expect(factory(themes[themeName]).discoveryCard).toMatchObject({ backgroundColor: themes[themeName].surface.card, borderRadius: 20 })
    expect(factory(themes[themeName]).photoBadge.backgroundColor).toBe(themes[themeName].surface.card)
    create.mockRestore()
    await render(<PlaceCard place={fixture({ photoSource: 'google', photoUrl: 'https://img.example/real.jpg', gogoRating: 4.8, gogoRatingCount: 8, discovery: { categoryLabel: 'Cà phê', tagLabels: ['Wi-Fi', 'Làm việc', 'Siphon'] } })} />)
    expect(screen.getByTestId('place-card-large')).toBeTruthy()
    expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(screen.getByText('★ 4,8 (8) GoGo')).toBeTruthy()
    expect(screen.getByText('45k–90k/người')).toBeTruthy()
    expect(screen.getByText('Siphon')).toBeTruthy()
    expect(screen.getByTestId('saved-photo-attribution')).toHaveTextContent(/Google/)
    expect(screen.getByText('Mở đến 20:00').props.numberOfLines).toBeUndefined()
  })
  it('uses the shared filled bookmark on Saved cards without opening the card', async () => {
    const remove = jest.fn()
    const open = jest.fn()
    await render(<PlaceCard place={fixture()} saved onToggleSave={remove} onPress={open} />)
    const bookmark = screen.getByRole('togglebutton', { name: 'Bỏ lưu' })
    expect(bookmark.props.accessibilityState.checked).toBe(true)
    expect(screen.getByTestId('icon-bookmark-filled')).toBeTruthy()
    await act(async () => { await fireEvent.press(bookmark) })
    expect(remove).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })

  it('keeps the real sample count below the community threshold and hides unknown price', async () => {
    await render(<PlaceCard place={fixture({ priceMin: null, priceMax: null, gogoRatingCount: 3 })} />)
    expect(screen.getByText('GoGo · Chưa đủ đánh giá (3)')).toBeTruthy()
    expect(screen.queryByText(/\/người/)).toBeNull()
  })
})

// A Google score must never become an unmarked community score in any rating-bearing variant.
describe('owner decision 2026-11-07 rating source marks', () => {
  it.each(['default', 'discovery', 'saved'] as const)('%s keeps both marked scores and independent sample sizes', async () => {
    await render(<PlaceCard place={fixture({ gogoRating: 4.8, gogoRatingCount: 20 })} />)
    expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(screen.getByText('★ 4,8 (20) GoGo')).toBeTruthy()
  })
  it.each(['default', 'discovery', 'saved'] as const)('%s marks Google even when the sample size is unknown', async () => {
    await render(<PlaceCard place={fixture({ ratingCount: undefined })} />)
    expect(screen.getByText(/★ 4,6\s+Google/)).toBeTruthy()
  })
})

it.each([false, true])('provider preview keeps every rendered Google score marked (compact=%s)', async compact => {
  const Component = compact ? PlaceCardSmall : PlaceCard
  await render(<Component preview={{ name: 'Provider cafe', googleRating: 4.6, googleRatingCount: 980 }} />)
  expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
})

it('hero keeps its Google rating visibly marked', async () => {
  await render(<PlaceCard place={fixture()} />)
  expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
})

describe('#561 shared small marker card', () => {
  it.each(['orange', 'orangeDark'] as const)('uses the common small layout, real facts and independent actions (%s)', async themeName => {
    const theme = themes[themeName]
    UnistylesStyleSheet.configure({ themes: { orange: theme } as typeof themes })
    try {
      const open = jest.fn()
      const save = jest.fn()
      await render(<PlaceCardSmall place={fixture({ gogoRatingCount: 3, discovery: { categoryLabel: 'Cà phê', tagLabels: ['Wi-Fi'], verified: true } })} onPress={open} saved={false} onToggleSave={save} />)
      expect(screen.getByTestId('place-card-small')).toBeTruthy()
      expect(flat('place-card-photo')).toMatchObject({ width: 80, height: 80, overflow: 'hidden' })
      expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
      expect(screen.getByTestId('place-card-name')).toHaveTextContent('Cà phê Đỗ Phủ')
      expect(screen.getByTestId('place-card-name').props.numberOfLines).toBe(1)
      expect(screen.getByTestId('place-card-body').children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-card-name', 'place-card-address-row', 'place-card-ratings'])
      for (const text of ['Cà phê', 'Wi-Fi', 'Mở đến 20:00']) expect(screen.queryByText(text)).toBeNull()
      for (const id of ['place-card-price', 'place-card-hours-badge', 'place-card-tags', 'place-card-distance']) expect(screen.queryByTestId(id)).toBeNull()
      expect(within(screen.getByTestId('place-card-photo')).getByTestId('place-card-verified')).toBeTruthy()
      expect(within(screen.getByTestId('place-card-body')).queryByTestId('place-card-verified')).toBeNull()
      expect(screen.getByTestId('place-card-meta')).toHaveTextContent('12 Nguyễn Huệ')
      expect(screen.getByTestId('place-card-meta').props.numberOfLines).toBe(1)
      expect(screen.getByTestId('place-card-ratings').children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-gogo-rating', 'place-google-rating'])
      expect(flat('place-card-ratings')).toMatchObject({ flexDirection: 'column', flexWrap: 'nowrap' })
      for (const label of ['GoGo · Chưa đủ đánh giá (3)', '★ 4,6 (980) Google']) {
        const text = screen.getByText(label)
        expect(text.props.numberOfLines).toBe(1)
        expect(text.props.ellipsizeMode).toBe('tail')
        expect(StyleSheet.flatten(text.props.style).flexShrink).toBe(1)
      }
      expect(screen.getByLabelText('★ 4,6 (980) Google')).toBe(screen.getByText('★ 4,6 (980) Google'))
      for (const id of ['place-gogo-rating', 'place-google-rating']) {
        expect(StyleSheet.flatten(screen.getByTestId(id).props.style)).toMatchObject({ maxWidth: '100%', flexShrink: 1 })
      }
      // The shell padding supplies equal left-content and right-bookmark insets.
      expect(flat('place-card-surface').padding).toBe(theme.spacing[2])
      expect(flat('place-card-save')).toMatchObject({ top: 0, right: 0 })
      expect(flat('place-card-save').marginRight).toBeUndefined()
      await fireEvent.press(screen.getByTestId('place-card-save'))
      expect(save).toHaveBeenCalledTimes(1)
      expect(open).not.toHaveBeenCalled()
      await fireEvent.press(screen.getByTestId('place-card-open-target'))
      expect(open).toHaveBeenCalledTimes(1)
    } finally { UnistylesStyleSheet.configure({ themes }) }
  })

  it('F-09: keeps the photo placeholder while omitting unknown ratings, facts and guest save actions', async () => {
    await render(<PlaceCardSmall place={fixture({ addressText: undefined, rating: undefined, ratingCount: undefined, openNow: undefined, distanceM: undefined, discovery: undefined, priceMin: null, priceMax: null })} />)
    for (const id of ['place-card-meta', 'place-google-rating', 'place-card-price', 'place-card-save', 'place-card-photo-badges']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryByTestId('place-gogo-rating')).toBeNull()
    expect(screen.queryByTestId('place-card-ratings')).toBeNull()
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
  })

  it.each([0, 3, 4])('F-09: keeps known below-threshold GoGo review wording (%i)', async gogoRatingCount => {
    await render(<PlaceCardSmall place={fixture({ rating: undefined, ratingCount: undefined, gogoRating: 4.9, gogoRatingCount })} />)
    expect(screen.getByText(`GoGo · Chưa đủ đánh giá (${gogoRatingCount})`)).toBeTruthy()
    expect(screen.queryByText(/4,9/)).toBeNull()
    expect(screen.queryByTestId('place-google-rating')).toBeNull()
  })
})
