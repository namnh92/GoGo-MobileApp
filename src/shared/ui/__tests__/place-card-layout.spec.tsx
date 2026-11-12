import { render } from './query-render'
import '@/shared/i18n'
import { fireEvent,  screen, within } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import { detailToPlaceCard, toPlaceCard, type PlaceDetail, type PlaceSearchResult, type PlaceCard as PlaceCardModel } from '@/shared/api'
import { PlaceCardLarge } from '../place-card-large.view'
import { PlaceCardSmall } from '../place-card-small.view'
import { ThemeScopeProvider } from '../scoped-theme'
import { darkStatus, overlay, spacing, touchTarget } from '../tokens'
import { themes } from '../theme'
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles'

jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: undefined }),
  useAdministrativeUnits: () => ({ data: [] }),
}))
jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const full: PlaceCardModel = {
  id: 'layout-place', name: 'Place name', addressText: 'Verified street', photoUrl: 'https://example.com/photo.jpg', photoAttribution: 'Photographer', photoSource: 'google', ratingSource: 'google',
  photoAuthors: [{ displayName: 'Author', uri: 'https://example.com/author', photoUri: null }],
  priceMin: 45000, priceMax: 90000, priceUnit: 'per_person', currency: 'VND', priceUncertain: false,
  openNow: true, closesAtMinute: 1439, distanceM: 800, rating: 4.6, ratingCount: 980,
  gogoRating: 4.9, gogoRatingCount: 142, isLodging: false, reasonCodes: [],
  discovery: { verified: true, categoryLabel: 'Category', tagLabels: ['Purpose', 'Vibe'] },
}
const minimal: PlaceCardModel = { ...full, addressText: undefined, photoUrl: null, photoAttribution: null, photoAuthors: undefined,
  priceMin: null, priceMax: null, priceUnit: 'unknown', openNow: undefined, distanceM: undefined,
  rating: undefined, ratingCount: undefined, gogoRating: undefined, gogoRatingCount: undefined, discovery: undefined }

// Snapshot semantic structure and text constraints only. Colours/styles are deliberately excluded.
type Node = ReturnType<typeof screen.getByTestId>
function structure(node: Node): unknown {
  return node.children.flatMap(child => {
    if (typeof child === 'string') return []
    const children = structure(child)
    return child.props.testID ? [{ id: child.props.testID, lines: child.props.numberOfLines, children }] : children as unknown[]
  })
}
const components = [['LARGE', PlaceCardLarge], ['SMALL', PlaceCardSmall]] as const

// Owner-reported DEV facts, represented as DTO fixtures; no live-response claim.
const landmark: Partial<PlaceDetail> = {
  id: '5f6ea4a0-9853-497c-a06d-d54c72580643', name: 'Landmark 81 SkyView',
  rating: 4.5, ratingCount: 6100, gogoRatingCount: 0,
  photos: [{ id: 'landmark-photo', url: 'https://example.com/landmark.jpg', source: 'manual' }],
  prices: [{ priceMin: 250000, priceMax: 450000, currency: 'VND', unit: 'per_person', confidence: 1 }],
  hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openMinute: 0, closeMinute: 1439 })),
  taxonomies: [{ kind: 'category', key: 'attraction' }],
}
const labels = { category: { attraction: 'Tham quan' } }
const adapters = [
  ['detail / Saved hydration', (verification: PlaceDetail['verification']) => detailToPlaceCard({ ...landmark, verification }, labels)],
  ['search / Home / Explore', (verification: PlaceDetail['verification']) => toPlaceCard({
    id: landmark.id!, name: landmark.name!, lat: 10.795, lng: 106.722, isLodging: false,
    rating: landmark.rating, ratingCount: landmark.ratingCount, primaryPhoto: landmark.photos![0],
    pricePerPerson: { min: 250000, max: 450000, currency: 'VND', confidence: 1 },
    open: { openNow: true, closesAtMinute: 1439 }, reasonCodes: [], confidence: 1,
    taxonomies: landmark.taxonomies, verification,
  // Absent verification models an older/incomplete response despite the required search contract.
  } as PlaceSearchResult, labels)],
] as const

describe.each(['orange', 'orangeDark'] as const)('#564 DTO verification / %s', theme => {
  describe.each(adapters)('%s', (_source, adapt) => {
    it.each(components)('%s renders explicit verified facts and hides absent/unverified facts', async (name, Component) => {
      const view = await render(<ThemeScopeProvider name={theme}><Component place={adapt({ status: 'verified', verifiedAt: '2026-11-08T13:07:57Z' })} /></ThemeScopeProvider>)
      const slot = within(screen.getByTestId('place-card-photo'))
      expect(slot.getByTestId('place-card-verified')).toHaveTextContent('Xác minh')
      if (name === 'LARGE') expect(screen.getByTestId('place-card-price')).toHaveTextContent('250k–450k/người')
      expect(screen.getByTestId('place-google-rating')).toHaveTextContent('★ 4,5 (6.100) Google')
      expect(!!screen.queryByText('Tham quan')).toBe(name === 'LARGE')
      expect(screen.getByTestId('place-photo-image')).toBeTruthy()
      expect(!!screen.queryByTestId('place-card-hours-badge')).toBe(name === 'LARGE')
      for (const verification of [undefined, { status: 'unverified' } as const]) {
        await view.rerender(<ThemeScopeProvider name={theme}><Component place={adapt(verification)} /></ThemeScopeProvider>)
        expect(screen.queryByTestId('place-card-verified')).toBeNull()
        expect(screen.getByTestId('place-card-name')).toHaveTextContent('Landmark 81 SkyView')
      }
    })
  })
})

describe.each(['orange', 'orangeDark'] as const)('owner 2026-11-08 two common cards / %s', theme => {
  it.each(components)('%s pins full-data structure and the facts allowed by its size', async (name, Component) => {
    await render(<ThemeScopeProvider name={theme}><Component place={full} saved onToggleSave={jest.fn()} /></ThemeScopeProvider>)
    expect(structure(screen.getByTestId('place-card-surface'))).toMatchSnapshot(name + ' full')
    for (const id of ['place-card-verified', 'place-photo-image', 'saved-photo-attribution', 'place-google-rating', 'place-gogo-rating', 'place-card-save']) expect(screen.getByTestId(id)).toBeTruthy()
    for (const text of ['★ 4,6 (980) Google', '★ 4,9 (142) GoGo']) expect(screen.getByText(text)).toBeTruthy()
    for (const text of ['Category', 'Purpose', 'Vibe', '800 m']) expect(!!screen.queryByText(text)).toBe(name === 'LARGE')
    for (const id of ['place-card-hours-badge', 'place-card-price', 'place-card-tags', 'place-card-distance']) expect(!!screen.queryByTestId(id)).toBe(name === 'LARGE')
    if (name === 'LARGE') {
      expect(screen.getByTestId('place-card-price')).toHaveTextContent('45k–90k/người')
      expect(StyleSheet.flatten(screen.getByTestId('place-card-ratings').props.style).flexDirection).toBe('row')
      expect(screen.getByTestId('place-card-ratings').children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-google-rating', 'place-gogo-rating'])
      expect(screen.getByText('★ 4,6 (980) Google').props.numberOfLines).toBe(1)
    }
    expect(screen.getByTestId('place-card-meta').props.numberOfLines).toBe(name === 'LARGE' ? 2 : 1)
    expect(screen.getByTestId('place-card-name').props.numberOfLines).toBe(1)
    expect(screen.getByRole('link')).toBeTruthy()
  })
  it.each(components)('%s pins minimal structure and omits missing facts only', async (name, Component) => {
    await render(<ThemeScopeProvider name={theme}><Component place={minimal} /></ThemeScopeProvider>)
    expect(structure(screen.getByTestId('place-card-surface'))).toMatchSnapshot(name + ' minimal')
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
    for (const id of ['place-card-meta', 'place-card-verified', 'saved-photo-attribution', 'place-card-hours-badge', 'place-card-price', 'place-google-rating', 'place-card-tags', 'place-card-distance', 'place-card-save']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryByTestId('place-gogo-rating')).toBeNull()
    expect(screen.queryByTestId('place-card-ratings')).toBeNull()
  })
  it('LARGE reserves the upper corners for verified/save and lower left for status; category stays in tags', async () => {
    await render(<ThemeScopeProvider name={theme}><PlaceCardLarge place={full} saved onToggleSave={jest.fn()} /></ThemeScopeProvider>)
    const photo = screen.getByTestId('place-card-photo')
    const footer = within(photo).getByTestId('place-card-photo-footer')
    expect(StyleSheet.flatten(photo.props.style)).toMatchObject({ aspectRatio: 1.6 })
    expect(StyleSheet.flatten(footer.props.style)).toMatchObject({ position: 'absolute', left: 12, bottom: 12 })
    expect(within(footer).getByTestId('place-card-hours-badge')).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('place-card-hours-badge').props.style).backgroundColor).toBe(overlay.scrimText)
    expect(StyleSheet.flatten(within(photo).getByTestId('place-card-verified').props.style)).toMatchObject({ top: 12, left: 12 })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-save').props.style)).toMatchObject({ top: 12, right: 12 })
    expect(within(photo).queryByText('Category')).toBeNull()
    expect(within(screen.getByTestId('place-card-body')).getByText('Category')).toBeTruthy()
    expect(within(screen.getByTestId('place-card-address-row')).getByTestId('material-icon-location', { includeHiddenElements: true })).toBeTruthy()
  })
  it.each(components)('%s preserves closed/next-open wording, below-threshold counts and independent save', async (name, Component) => {
    const save = jest.fn(), open = jest.fn()
    await render(<ThemeScopeProvider name={theme}><Component place={{ ...full, openNow: false, opensAtMinute: 480, opensDayOffset: 1, gogoRatingCount: 4 }} onPress={open} saved onToggleSave={save} /></ThemeScopeProvider>)
    expect(screen.getByText('GoGo · Chưa đủ đánh giá (4)')).toBeTruthy()
    expect(screen.queryByText('★ 4,9 (4) GoGo')).toBeNull()
    if (name === 'LARGE') expect(screen.getByText('Đã đóng · Mở 08:00 ngày mai').props.numberOfLines).toBeUndefined()
    else expect(screen.queryByText('Đã đóng · Mở 08:00 ngày mai')).toBeNull()
    await fireEvent.press(screen.getByTestId('place-card-save'))
    expect(save).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled()
  })
  it('SMALL has exactly name → pinned address → GoGo/Google lines, with verified on the square photo', async () => {
    await render(<ThemeScopeProvider name={theme}><PlaceCardSmall place={full} tags={['Extra tag']} categoryLabel="Extra category" unavailableLabel="Unavailable" bodyLeading={<View testID="feature-leading" />} bodyTrailing={<View testID="feature-trailing" />} headingAction={<View testID="heading-action" />} /></ThemeScopeProvider>)
    expect(StyleSheet.flatten(screen.getByTestId('place-card-small').props.style)).toMatchObject({ flexDirection: 'row', gap: 12 })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-photo').props.style)).toMatchObject({ width: 80, height: 80 })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-ratings').props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-surface').props.style)).toMatchObject({ padding: 8, borderRadius: 16, borderWidth: 1 })
    const body = screen.getByTestId('place-card-body')
    expect(body.children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-card-name', 'place-card-address-row', 'place-card-ratings'])
    expect(within(body).queryByTestId('place-card-verified')).toBeNull()
    expect(within(screen.getByTestId('place-card-address-row')).getByTestId('material-icon-location', { includeHiddenElements: true })).toBeTruthy()
    const ratings = screen.getByTestId('place-card-ratings')
    expect(ratings.children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-gogo-rating', 'place-google-rating'])
    const badge = within(screen.getByTestId('place-card-photo')).getByTestId('place-card-verified')
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ position: 'absolute', bottom: 0, left: 0, right: 0 })
    const verifiedText = within(badge).getByText('Xác minh')
    expect(verifiedText.props.numberOfLines).toBe(1)
    expect(StyleSheet.flatten(verifiedText.props.style).color).toBe(themes[theme].text.inverse)
    for (const text of ['Extra tag', 'Extra category', 'Unavailable']) expect(screen.queryByText(text)).toBeNull()
    for (const id of ['feature-leading', 'feature-trailing', 'heading-action']) expect(screen.queryByTestId(id)).toBeNull()
  })
  it.each([0, 1, 4, 5, 142])('SMALL at 390pt keeps one-line rating pills and the bookmark at the content inset (GoGo count %s)', async count => {
    const save = jest.fn(), open = jest.fn()
    await render(<ThemeScopeProvider name={theme}><PlaceCardSmall
      place={{ ...full, name: 'Địa điểm với tên rất dài để kiểm tra hàng tiêu đề trên bản đồ', addressText: '123 Đường Nguyễn Thị Minh Khai, Phường Sài Gòn, Thành phố Hồ Chí Minh', rating: 4.5, ratingCount: 1395, gogoRatingCount: count }}
      style={{ width: 390 }} saved onToggleSave={save} onPress={open}
    /></ThemeScopeProvider>)
    const surface = StyleSheet.flatten(screen.getByTestId('place-card-surface').props.style)
    expect(surface).toMatchObject({ width: 390, padding: spacing[2] })
    const action = screen.getByTestId('place-card-save')
    const actionStyle = StyleSheet.flatten(action.props.style)
    // The shell already supplies the same inset at both content edges.
    expect(actionStyle).toMatchObject({ top: 0, right: 0, width: 22, height: 22 })
    expect(actionStyle.marginRight).toBeUndefined()
    expect(actionStyle.width + action.props.hitSlop.left + action.props.hitSlop.right).toBeGreaterThanOrEqual(touchTarget.min)
    expect(actionStyle.height + action.props.hitSlop.top + action.props.hitSlop.bottom).toBeGreaterThanOrEqual(touchTarget.min)
    expect(StyleSheet.flatten(screen.getByTestId('place-card-small').props.style).alignItems).toBe('flex-start')
    expect(StyleSheet.flatten(screen.getByTestId('place-card-name').props.style)).toMatchObject({ paddingVertical: 2, paddingRight: 22 + spacing[3] })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-body').props.style).paddingRight).toBeUndefined()
    expect(StyleSheet.flatten(screen.getByTestId('place-card-ratings').props.style)).toMatchObject({ flexDirection: 'column', flexWrap: 'nowrap' })
    const ratings = screen.getByTestId('place-card-ratings')
    expect(ratings.children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-gogo-rating', 'place-google-rating'])
    expect(screen.getByTestId('place-gogo-rating')).toHaveTextContent(count < 5 ? `GoGo · Chưa đủ đánh giá (${count})` : `★ 4,9 (${count}) GoGo`)
    expect(screen.getByTestId('place-google-rating')).toHaveTextContent('★ 4,5 (1.395) Google')
    for (const id of ['place-gogo-rating', 'place-google-rating']) {
      const pill = screen.getByTestId(id)
      expect(StyleSheet.flatten(pill.props.style)).toMatchObject({ flexShrink: 1, maxWidth: '100%' })
      const text = within(pill).getByText(/GoGo|Google/)
      expect(text.props.numberOfLines).toBe(1)
      expect(text.props.ellipsizeMode).toBe('tail')
      expect(StyleSheet.flatten(text.props.style).flexShrink).toBe(1)
    }
    await fireEvent.press(action)
    expect(save).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })
  it('SMALL appends a generic caption after name, address and ratings', async () => {
    await render(<PlaceCardSmall place={full} caption={<View testID="custom-caption" />} />)
    const body = screen.getByTestId('place-card-body')
    expect(body.children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-card-name', 'place-card-address-row', 'place-card-ratings', 'custom-caption'])
    expect(screen.getByTestId('saved-photo-attribution')).toBeTruthy()
  })
  it.each(components)('%s keeps its photo frame while loading, loaded and failed', async (_name, Component) => {
    await render(<Component place={full} />)
    const photo = screen.getByTestId('place-card-photo')
    const frame = screen.getByTestId('place-photo-frame')
    const geometry = StyleSheet.flatten(photo.props.style)
    const frameGeometry = StyleSheet.flatten(frame.props.style)
    expect(screen.getByTestId('place-photo-loading', { includeHiddenElements: true })).toBeTruthy()
    await fireEvent(screen.getByTestId('place-photo-image'), 'load', { nativeEvent: {} })
    expect(screen.getByTestId('place-photo-underlay', { includeHiddenElements: true })).toBeTruthy()
    await fireEvent(screen.getByTestId('place-photo-image'), 'error', { nativeEvent: {} })
    expect(screen.queryByTestId('place-photo-image')).toBeNull()
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('place-card-photo').props.style)).toEqual(geometry)
    expect(StyleSheet.flatten(screen.getByTestId('place-photo-frame').props.style)).toEqual(frameGeometry)
    expect(within(photo).getByTestId('place-card-verified')).toBeTruthy()
  })
  it('SMALL uses the theme’s solid verified fill over photos in Light and Dark', () => {
    // Unistyles' Jest mock resolves styles with the first theme; evaluate the
    // production factory explicitly to cover the Dark surface too.
    const create = jest.spyOn(UnistylesStyleSheet, 'create')
    try {
      jest.isolateModules(() => { jest.requireActual('../place-card.style') })
      const factory = create.mock.calls[0][0] as (value: typeof themes.orange) => { compactVerified: { backgroundColor: string } }
      expect(factory(themes[theme]).compactVerified.backgroundColor).toBe(themes[theme].status.successStrongFill)
    } finally { create.mockRestore() }
  })
  it('LARGE retains the existing status-pill fix at narrow widths', async () => {
    await render(<PlaceCardLarge place={full} style={{ width: 288 }} />)
    expect(StyleSheet.flatten(screen.getByText('Mở đến 23:59').props.style).color).toBe(darkStatus.successText)
    expect(screen.getByText('Mở đến 23:59').props.numberOfLines).toBeUndefined()
  })
  it.each(components)('%s preserves feature controls without replacing common facts', async (name, Component) => {
    await render(<Component place={full} photoOverlay={<View testID="feature-overlay" />} bodyLeading={<View testID="feature-leading" />} bodyTrailing={<View testID="feature-trailing" />} />)
    expect(within(screen.getByTestId('place-card-photo')).getByTestId('feature-overlay')).toBeTruthy()
    for (const id of ['place-card-name', 'place-card-ratings']) expect(within(screen.getByTestId('place-card-body')).getByTestId(id)).toBeTruthy()
    for (const id of ['feature-leading', 'feature-trailing']) expect(!!screen.queryByTestId(id)).toBe(name === 'LARGE')
  })
})
