import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles'
import { themes, type AppTheme } from '@/shared/ui/theme'

import type { PlaceCard as PlaceCardModel } from '@/shared/api'
import i18n from '@/shared/i18n'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { accents, status, text, type } from '@/shared/ui/tokens'

let mockRealAdministrative = false
let mockProvinces: { code: string; fullName: string; nameEn?: string }[] = []
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => mockRealAdministrative ? jest.requireActual('@/shared/administrative/queries').useAdministrativeVersion() : ({ data: { datasetVersion: '2026-11' } }),
  useAdministrativeUnits: (version: string) => mockRealAdministrative ? jest.requireActual('@/shared/administrative/queries').useAdministrativeUnits(version) : ({ data: mockProvinces }),
}))
beforeEach(() => { mockProvinces = [{ code: '79', fullName: 'Thành phố Hồ Chí Minh', nameEn: 'Ho Chi Minh City' }]; mockRealAdministrative = false })

/**
 * #295 — the list PlaceCard per #293 §3 and the owner decisions of 2026-09-24
 * (no "Google" on the line, chips stay, no attribution on the card).
 *
 * jest has no layout engine, so "fits at 375 and 402pt" is measured on a
 * device. What this file locks is what makes clipping impossible: every row is
 * one string on one line with a tail ellipsis, and the name gets two.
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
const oneLine = (id: string) => {
  const node = screen.getByTestId(id)
  expect(node.props.numberOfLines).toBe(1)
  expect(node.props.ellipsizeMode).toBe('tail')
}

describe('PlaceCard — list', () => {
  it('renders the spec lines with a two-line address', async () => {
    await render(<PlaceCard place={fixture()} categoryLabel="Cà phê" />)

    expect(screen.getByTestId('place-card-name').props.numberOfLines).toBe(2)
    expect(screen.getByText('Cà phê Đỗ Phủ')).toBeTruthy()

    expect(screen.getByTestId('place-card-meta')).toHaveTextContent('12 Nguyễn Huệ', { exact: true })
    expect(screen.getByTestId('place-card-meta').props.numberOfLines).toBe(2)

    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('★ 4,6 (980) · 45k–90k/người', { exact: true })
    oneLine('place-card-rating-price')

    expect(screen.getByTestId('place-card-open')).toHaveTextContent('Đang mở · Đóng 20:00', { exact: true })
    oneLine('place-card-open')
  })

  it('never shows "Google" on the card, and keeps the source in the rating line\'s label', async () => {
    await render(<PlaceCard place={fixture()} categoryLabel="Cà phê" />)
    expect(screen.queryByText(/Google/)).toBeNull()
    expect(screen.getByTestId('place-card-rating-price').props.accessibilityLabel).toBe(
      'Google 4,6 sao, 980 đánh giá, 45k–90k/người',
    )
  })

  it('drops the photo attribution caption (owner decision 3)', async () => {
    await render(<PlaceCard place={fixture({ photoUrl: 'https://img.example/p1.jpg' })} />)
    expect(screen.queryByText('Ảnh: Google Maps')).toBeNull()
  })

  it('uses the type scale and semantic colours for each line', async () => {
    await render(<PlaceCard place={fixture()} categoryLabel="Cà phê" />)
    expect(flat('place-card-name')).toMatchObject({ ...type.title2, color: text.primary })
    expect(flat('place-card-meta')).toMatchObject({ ...type.bodySmall, color: text.secondary })
    expect(flat('place-card-rating-price')).toMatchObject({ ...type.bodySmall, color: text.primary })
    expect(flat('place-card-open')).toMatchObject({ ...type.label, color: status.successText })
  })

  it('is a solid card clipped to its corners, photo over body (Stitch)', async () => {
    await render(<PlaceCard place={fixture()} />)
    expect(flat('place-card')).toMatchObject({ overflow: 'hidden', borderRadius: 20 })
    expect(flat('place-card').flexDirection).not.toBe('row')
  })

  it('no rating: the line is the price alone, with no accessibility override', async () => {
    await render(<PlaceCard place={fixture({ rating: undefined, ratingCount: undefined })} />)
    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('45k–90k/người', { exact: true })
    expect(screen.getByTestId('place-card-rating-price').props.accessibilityLabel).toBeUndefined()
  })

  it('rating without a count: no empty parentheses', async () => {
    await render(<PlaceCard place={fixture({ ratingCount: undefined })} />)
    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('★ 4,6 · 45k–90k/người', { exact: true })
    expect(screen.getByTestId('place-card-rating-price').props.accessibilityLabel).toBe('Google 4,6 sao, 45k–90k/người')
  })

  it('unknown price leaves only the rating on one line', async () => {
    await render(<PlaceCard place={fixture({ priceMin: null, priceMax: null })} />)
    const line = screen.getByTestId('place-card-rating-price')
    expect(line).toHaveTextContent('★ 4,6 (980)', { exact: true })
    expect(line.props.numberOfLines).toBe(1)
  })

  it('unknown price has no separator or amount', async () => {
    await render(<PlaceCard place={fixture({ priceMin: null, priceMax: null })} />)
    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('★ 4,6 (980)', { exact: true })
  })

  it('free is the whole price part', async () => {
    await render(<PlaceCard place={fixture({ priceUnit: 'free', priceMin: null, priceMax: null })} />)
    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('★ 4,6 (980) · Miễn phí', { exact: true })
  })

  it('closed: secondary colour and the opening time, in words', async () => {
    await render(<PlaceCard place={fixture({ openNow: false, opensAtMinute: 1020 })} />)
    expect(screen.getByTestId('place-card-open')).toHaveTextContent('Đã đóng · Mở 17:00', { exact: true })
    expect(flat('place-card-open').color).toBe(text.secondary)
    expect(screen.queryByTestId('place-card-open-dot', { includeHiddenElements: true })).toBeNull()
  })

  it('open: a status.success dot sits before the label, so it never reads as a green button (#297)', async () => {
    await render(<PlaceCard place={fixture()} />)
    // Decorative: hidden from the screen reader, which already hears the words.
    const dot = screen.getByTestId('place-card-open-dot', { includeHiddenElements: true })
    expect(StyleSheet.flatten(dot.props.style)).toMatchObject({ backgroundColor: status.success, borderRadius: 3 })
    // Shape, not colour: the label itself has no fill.
    expect(flat('place-card-open').backgroundColor).toBeUndefined()
  })

  it('unknown open state: the line is omitted', async () => {
    await render(<PlaceCard place={fixture({ openNow: undefined })} />)
    expect(screen.queryByTestId('place-card-open')).toBeNull()
  })

  it('renders the same address when distance is absent', async () => {
    await render(<PlaceCard place={fixture({ distanceM: undefined })} categoryLabel="Cà phê" />)
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent('12 Nguyễn Huệ', { exact: true })
  })

  it('no photo: the neutral pin placeholder', async () => {
    await render(<PlaceCard place={fixture()} />)
    // Decorative, so hidden from the accessibility tree.
    expect(screen.getByTestId('icon-map-pin', { includeHiddenElements: true })).toBeTruthy()
  })

  it('tags: at most two info chips', async () => {
    await render(<PlaceCard place={fixture()} tags={['Yên tĩnh', 'Có chỗ đậu xe', 'Lãng mạn']} />)
    expect(screen.getByText('Yên tĩnh')).toBeTruthy()
    expect(screen.getByText('Có chỗ đậu xe')).toBeTruthy()
    expect(screen.queryByText('Lãng mạn')).toBeNull()
  })

  // #332: at 375pt the two chips sat on two lines. jest has no layout, so this
  // locks what keeps them on one: no wrap, and chip + label shrink to ellipsis.
  it('tags: one row — chips shrink and ellipsise instead of wrapping (#332)', async () => {
    await render(<PlaceCard place={fixture()} tags={['Không gian yên tĩnh để trò chuyện', 'Có chỗ đậu xe ô tô rộng']} />)
    const label = screen.getByText('Không gian yên tĩnh để trò chuyện')
    const chip = label.parent
    const row = chip?.parent
    const flat = (node: typeof label | null | undefined) => StyleSheet.flatten(node?.props.style) ?? {}
    expect(flat(row).flexDirection).toBe('row')
    expect(flat(row).flexWrap ?? 'nowrap').toBe('nowrap')
    expect(flat(chip)).toMatchObject({ flexShrink: 1, minWidth: 0 })
    expect(flat(label).flexShrink).toBe(1)
    expect(label.props.numberOfLines).toBe(1)
  })

  it('save toggle: 44×44, checked state, filled glyph in the accent when saved', async () => {
    const onToggle = jest.fn()
    await render(<PlaceCard place={fixture()} saved onToggleSave={onToggle} />)
    const toggle = screen.getByTestId('place-card-save')
    expect(flat('place-card-save')).toMatchObject({ width: 44, height: 44 })
    expect(toggle.props.accessibilityRole).toBe('togglebutton')
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true })
    expect(screen.getByTestId('icon-bookmark-filled').props.stroke).toBe(accents.orange.primary)
    await act(async () => fireEvent.press(toggle))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('save toggle is a sibling of the card target, so a screen reader reaches it on its own (Sol #295 P2)', async () => {
    const onPress = jest.fn()
    const onToggle = jest.fn()
    await render(<PlaceCard place={fixture()} onPress={onPress} saved={false} onToggleSave={onToggle} />)
    const target = screen.getByTestId('place-card-open-target')
    const toggle = screen.getByTestId('place-card-save')
    let node = toggle.parent
    while (node) {
      expect(node).not.toBe(target)
      node = node.parent
    }
    await act(async () => fireEvent.press(toggle))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('a real photo: sizing and clip on a plain View, the image only fills it (Sol #295 P2)', async () => {
    await render(<PlaceCard place={fixture({ photoUrl: 'https://img.example/p1.jpg' })} />)
    const image = screen.getByLabelText('Cà phê Đỗ Phủ')
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: '100%', height: '100%' })
    expect(StyleSheet.flatten(image.parent!.parent!.props.style)).toMatchObject({ aspectRatio: 1.6 })
  })

  it('English: rating and count use English separators', async () => {
    await act(async () => { await i18n.changeLanguage('en') })
    try {
      await render(<PlaceCard place={fixture({ ratingCount: 1234 })} />)
      expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent(/^★ 4\.6 \(1,234\) · /)
    } finally {
      await act(async () => { await i18n.changeLanguage('vi') })
    }
  })

  it('save toggle unsaved: outline glyph in secondary', async () => {
    await render(<PlaceCard place={fixture()} saved={false} onToggleSave={jest.fn()} />)
    expect(screen.getByTestId('place-card-save').props.accessibilityState).toMatchObject({ checked: false })
    expect(screen.getByTestId('icon-bookmark').props.stroke).toBe(text.secondary)
  })

  it('guest (no save handler): no toggle at all', async () => {
    await render(<PlaceCard place={fixture()} />)
    expect(screen.queryByTestId('place-card-save')).toBeNull()
  })
})

describe('discovery appearance protects Saved/default', () => {
  const areaSummary: NonNullable<PlaceCardModel['areaSummary']> = {
    datasetVersion: '2026-11', provinceCode: '79', communeCode: '26740',
    label: 'Phường Sài Gòn', locale: 'vi',
  }

  it.each([
    ['12 Nguyễn Huệ', '12 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh'],
    [undefined, 'Sài Gòn, Hồ Chí Minh'],
    ['', 'Sài Gòn, Hồ Chí Minh'],
  ] as const)('renders address %s with matching accessibility text', async (addressText, expected) => {
    await render(<PlaceCard appearance="discovery" place={fixture({ addressText, areaSummary, discovery: { areaLabel: 'Discovery bucket' } })} />)
    const line = screen.getByTestId('place-card-meta')
    expect(line).toHaveTextContent(expected, { exact: true })
    expect(line.props.numberOfLines).toBe(2)
    expect(line.props.accessibilityLabel).toBe(expected)
    expect(flat('place-card-meta')).toMatchObject({ ...type.introSmall, color: themes.orange.redesign.secondary })
  })

  it('omits the address line without either fact instead of using the chip or area key', async () => {
    await render(<PlaceCard appearance="discovery" place={fixture({ addressText: undefined, areaKey: 'hcm_q3', discovery: { areaLabel: 'Discovery bucket' } })} />)
    expect(screen.queryByTestId('place-card-meta')).toBeNull()
    expect(screen.queryByLabelText('Discovery bucket')).toBeNull()
  })

  it('keeps the proper name when the label locale differs from the app language', async () => {
    await act(async () => { await i18n.changeLanguage('en') })
    try {
      await render(<PlaceCard appearance="discovery" place={fixture({ addressText: undefined, areaSummary })} />)
      expect(screen.getByTestId('place-card-meta')).toHaveTextContent('Sài Gòn, Hồ Chí Minh', { exact: true })
      expect(screen.getByLabelText('Sài Gòn, Hồ Chí Minh')).toBeTruthy()
    } finally {
      await act(async () => { await i18n.changeLanguage('vi') })
    }
  })

  it('renders separate rating sources and isolates save from open', async () => {
    const open = jest.fn(); const save = jest.fn()
    await render(<PlaceCard appearance="discovery" place={fixture({ gogoRating: 4.9, gogoRatingCount: 20 })} saved onPress={open} onToggleSave={save} />)
    expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(screen.getByText('★ 4,9 (20) GoGo')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('place-card-save'))
    expect(save).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })
  it.each([0, 4])('hides a community score below five reviews (%i)', async count => {
    await render(<PlaceCard appearance="discovery" place={fixture({ gogoRating: 4.9, gogoRatingCount: count })} />)
    expect(screen.queryByText(/4,9/)).toBeNull()
    expect(screen.getByText('GoGo · Chưa đủ đánh giá')).toBeTruthy()
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
describe('F-06 bounded discovery photo badges', () => {
  it.each(['orange', 'orangeDark'] as const)('shares a 264pt wrapping overlay inside a 288pt card on a 320pt phone (%s)', async themeName => {
    const create = jest.spyOn(UnistylesStyleSheet, 'create')
    jest.isolateModules(() => { jest.requireActual('../place-card.style') })
    const factory = create.mock.calls[0][0] as (theme: AppTheme) => Record<string, any>
    const styles = factory(themes[themeName])
    create.mockRestore()
    await render(<PlaceCard appearance="discovery" style={{ width: 320 - 2 * 16 }} place={fixture({ discovery: { areaLabel: 'Tỉnh Bà Rịa - Vũng Tàu', verified: true }, distanceM: 2100 })} saved onToggleSave={jest.fn()} />)
    const overlay = screen.getByTestId('place-card-photo-badges')
    expect(StyleSheet.flatten(screen.getByTestId('place-card-discovery').parent!.parent!.props.style).width).toBe(288)
    expect(styles.photoBadges).toMatchObject({ position: 'absolute', left: 12, right: 12, top: 64, bottom: 12, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-end', gap: 8 })
    expect(288 - styles.photoBadges.left - styles.photoBadges.right).toBe(264)
    expect(288 / styles.listPhoto.aspectRatio - styles.photoBadges.top - styles.photoBadges.bottom).toBe(104)
    expect(overlay.children).toHaveLength(1)
    for (const id of ['place-card-hours-badge']) {
      expect(screen.getByTestId(id).parent).toBe(overlay)
      expect(styles.photoBadge).toMatchObject({ maxWidth: '100%', minWidth: 0, flexShrink: 1, backgroundColor: themes[themeName].redesign.card })
      expect(styles.photoBadge.position).toBeUndefined()
      expect(screen.getByText('● Mở đến 20:00').props.numberOfLines).toBe(2)
    }
    expect(screen.queryByTestId('place-card-area-badge')).toBeNull()
    expect(screen.getByText('Xác minh')).toBeTruthy()
    expect(screen.getByText('● Mở đến 20:00')).toBeTruthy()
    expect(flat('place-card-save')).toMatchObject({ width: 44, height: 44 })
    // The two-line hours chip fits below the top actions at default text size.
    expect(2 * type.introCaptionMedium.lineHeight + 8).toBeLessThanOrEqual(104)
  })
  it.each([[false, false], [true, false], [false, true], [true, true]])('renders hours only regardless of area data (%s/%s)', async (area, hours) => {
    await render(<PlaceCard appearance="discovery" place={fixture({ distanceM: undefined, discovery: area ? { areaLabel: 'Tỉnh Bà Rịa - Vũng Tàu' } : undefined, openNow: hours ? true : undefined })} />)
    expect(Boolean(screen.queryByTestId('place-card-area-badge'))).toBe(false)
    expect(Boolean(screen.queryByTestId('place-card-hours-badge'))).toBe(hours)
    expect(Boolean(screen.queryByTestId('place-card-photo-badges'))).toBe(hours)
  })
  it.each(['list', 'hero'] as const)('does not add the discovery overlay to the default %s variant', async variant => {
    await render(<PlaceCard variant={variant} place={fixture({ discovery: { areaLabel: 'Tỉnh Bà Rịa - Vũng Tàu' } })} />)
    expect(screen.queryByTestId('place-card-photo-badges')).toBeNull()
    expect(screen.getByText('Cà phê Đỗ Phủ')).toBeTruthy()
  })
})


describe('#515 shared discovery card address', () => {
  it.each([
    ['12 Nguyễn Huệ', '12 Nguyễn Huệ, Quận 1, Hồ Chí Minh'],
    [undefined, 'Quận 1, Hồ Chí Minh'],
    ['  ', 'Quận 1, Hồ Chí Minh'],
  ])('appends the real ward to the street (%s)', async (addressText, expected) => {
    await render(<PlaceCard appearance="discovery" place={fixture({ addressText, areaSummary: { datasetVersion: '2026-11', provinceCode: '79', communeCode: '26740', label: 'Quận 1', locale: 'vi' }, discovery: { areaLabel: 'Discovery bucket' } })} />)
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent(expected!, { exact: true })
    expect(screen.getByTestId('place-card-meta').props.numberOfLines).toBe(2)
    expect(screen.getByTestId('place-card-meta').props.ellipsizeMode).toBe('tail')
    expect(screen.getByTestId('place-card-meta').props.accessibilityLabel).toBe(expected)
    expect(screen.getByTestId('place-card-name').props.numberOfLines).toBe(1)
    expect(screen.getByTestId('place-card-name').props.ellipsizeMode).toBe('tail')
  })
  it('omits address and overlays without facts, and unknown price', async () => {
    await render(<PlaceCard appearance="discovery" place={fixture({ addressText: undefined, distanceM: undefined, rating: undefined, ratingCount: undefined, openNow: undefined, priceMin: null, priceMax: null, priceUnit: 'unknown' })} />)
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
  ] as const)('normalizes the owner example for %s/%s', async (appearance, variant, addressText, label, expected) => {
    mockProvinces = [{ code: '01', fullName: 'Thành phố Hà Nội' }]
    await render(<PlaceCard appearance={appearance} variant={variant} place={fixture({
      addressText, areaSummary: { ...areaSummary, provinceCode: '01', label },
    })} />)
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent(expected, { exact: true })
    expect(screen.getByTestId('place-card-meta').props.accessibilityLabel).toBe(expected)
  })
  it.each([
    ['default', 'list'], ['discovery', 'list'], ['default', 'hero'],
  ] as const)('composes street, ward and cached province for %s/%s', async (appearance, variant) => {
    mockProvinces = [{ code: '79', fullName: 'Thành phố Hồ Chí Minh' }]
    await render(<PlaceCard appearance={appearance} variant={variant} place={fixture({ areaSummary })} />)
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
  it('keeps a closed status on two lines without a location chip', async () => {
    await render(<PlaceCard appearance="discovery" place={fixture({ openNow: false, opensAtMinute: 450, opensDayOffset: 1, discovery: { areaLabel: 'Phường Sài Gòn' } })} />)
    expect(screen.getByText('Đã đóng · Mở 07:30 ngày mai').props.numberOfLines).toBe(2)
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
    const view = await render(<QueryClientProvider client={client}><PlaceCard place={place} /><PlaceCard appearance="discovery" place={place} /></QueryClientProvider>)
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
    expect(factory(themes[themeName]).discoveryCard.backgroundColor).toBe(themes[themeName].redesign.card)
    create.mockRestore()
    await render(<PlaceCard appearance="saved" place={fixture({ photoSource: 'google', photoUrl: 'https://img.example/real.jpg', gogoRating: 4.8, gogoRatingCount: 8, discovery: { categoryLabel: 'Cà phê', tagLabels: ['Wi-Fi', 'Làm việc', 'Siphon'] } })} />)
    expect(screen.getByTestId('place-card-saved')).toBeTruthy()
    expect(screen.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(screen.getByText('★ 4,8 (8) GoGo')).toBeTruthy()
    expect(screen.getByText('45k–90k/người')).toBeTruthy()
    expect(screen.getByText('Siphon')).toBeTruthy()
    expect(screen.getByTestId('saved-photo-attribution')).toHaveTextContent(/Google/)
    expect(screen.getByText('● Mở đến 20:00').props.numberOfLines).toBe(1)
  })
  it('keeps the real sample count below the community threshold and hides unknown price', async () => {
    await render(<PlaceCard appearance="saved" place={fixture({ priceMin: null, priceMax: null, gogoRatingCount: 3 })} />)
    expect(screen.getByText('GoGo · Chưa đủ đánh giá (3)')).toBeTruthy()
    expect(screen.queryByText(/\/người/)).toBeNull()
  })
})
