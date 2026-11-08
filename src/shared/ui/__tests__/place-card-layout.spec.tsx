import '@/shared/i18n'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import { detailToPlaceCard, toPlaceCard, type PlaceDetail, type PlaceSearchResult, type PlaceCard as PlaceCardModel } from '@/shared/api'
import { PlaceCardLarge } from '../place-card-large.view'
import { PlaceCardSmall } from '../place-card-small.view'
import { ThemeScopeProvider } from '../scoped-theme'
import { darkStatus, overlay } from '../tokens'

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
      const slot = within(screen.getByTestId(name === 'LARGE' ? 'place-card-photo' : 'place-card-body'))
      expect(slot.getByTestId('place-card-verified')).toHaveTextContent('Xác minh')
      expect(screen.getByTestId('place-card-price')).toHaveTextContent('250k–450k/người')
      expect(screen.getByTestId('place-google-rating')).toHaveTextContent('★ 4,5 (6.100) Google')
      expect(screen.getByText('Tham quan')).toBeTruthy()
      expect(screen.getByTestId('place-photo-image')).toBeTruthy()
      expect(screen.getByTestId('place-card-hours-badge')).toBeTruthy()
      for (const verification of [undefined, { status: 'unverified' } as const]) {
        await view.rerender(<ThemeScopeProvider name={theme}><Component place={adapt(verification)} /></ThemeScopeProvider>)
        expect(screen.queryByTestId('place-card-verified')).toBeNull()
        expect(screen.getByTestId('place-card-name')).toHaveTextContent('Landmark 81 SkyView')
      }
    })
  })
})

describe.each(['orange', 'orangeDark'] as const)('owner 2026-11-08 two common cards / %s', theme => {
  it.each(components)('%s pins full-data structure and retains every conditional fact', async (name, Component) => {
    await render(<ThemeScopeProvider name={theme}><Component place={full} saved onToggleSave={jest.fn()} /></ThemeScopeProvider>)
    expect(structure(screen.getByTestId('place-card-surface'))).toMatchSnapshot(name + ' full')
    for (const id of ['place-card-verified', 'place-photo-image', 'saved-photo-attribution', 'place-card-hours-badge', 'place-card-price', 'place-google-rating', 'place-gogo-rating', 'place-card-tags', 'place-card-distance', 'place-card-save']) expect(screen.getByTestId(id)).toBeTruthy()
    for (const text of ['Category', 'Purpose', 'Vibe', '800 m', '★ 4,6 (980) Google', '★ 4,9 (142) GoGo']) expect(screen.getByText(text)).toBeTruthy()
    expect(screen.getByTestId('place-card-price')).toHaveTextContent('45k–90k/người')
    expect(screen.getByTestId('place-card-meta').props.numberOfLines).toBe(name === 'LARGE' ? 2 : 1)
    expect(screen.getByTestId('place-card-name').props.numberOfLines).toBe(1)
    expect(screen.getByRole('link')).toBeTruthy()
  })
  it.each(components)('%s pins minimal structure and omits missing facts only', async (name, Component) => {
    await render(<ThemeScopeProvider name={theme}><Component place={minimal} /></ThemeScopeProvider>)
    expect(structure(screen.getByTestId('place-card-surface'))).toMatchSnapshot(name + ' minimal')
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
    for (const id of ['place-card-meta', 'place-card-verified', 'saved-photo-attribution', 'place-card-hours-badge', 'place-card-price', 'place-google-rating', 'place-gogo-rating', 'place-card-tags', 'place-card-distance', 'place-card-save']) expect(screen.queryByTestId(id)).toBeNull()
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
  it.each(components)('%s preserves closed/next-open wording, below-threshold counts and independent save', async (_name, Component) => {
    const save = jest.fn(), open = jest.fn()
    await render(<ThemeScopeProvider name={theme}><Component place={{ ...full, openNow: false, opensAtMinute: 480, opensDayOffset: 1, gogoRatingCount: 4 }} onPress={open} saved onToggleSave={save} /></ThemeScopeProvider>)
    expect(screen.getByText('GoGo · Chưa đủ đánh giá (4)')).toBeTruthy()
    expect(screen.queryByText('★ 4,9 (4) GoGo')).toBeNull()
    const label = screen.getByText('Đã đóng · Mở 08:00 ngày mai')
    expect(label.props.numberOfLines).toBeUndefined()
    await fireEvent.press(screen.getByTestId('place-card-save'))
    expect(save).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled()
  })
  it('SMALL keeps the reference thumbnail row and stacked rating pills', async () => {
    await render(<PlaceCardSmall place={full} />)
    expect(StyleSheet.flatten(screen.getByTestId('place-card-small').props.style)).toMatchObject({ flexDirection: 'row', gap: 12 })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-photo').props.style)).toMatchObject({ width: 80, height: 80 })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-ratings').props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' })
    expect(StyleSheet.flatten(screen.getByTestId('place-card-surface').props.style)).toMatchObject({ padding: 8, borderRadius: 16, borderWidth: 1 })
  })
  it('LARGE retains the existing status-pill fix at narrow widths', async () => {
    await render(<PlaceCardLarge place={full} style={{ width: 288 }} />)
    expect(StyleSheet.flatten(screen.getByText('Mở đến 23:59').props.style).color).toBe(darkStatus.successText)
    expect(screen.getByText('Mở đến 23:59').props.numberOfLines).toBeUndefined()
  })
  it.each(components)('%s preserves feature controls without replacing common facts', async (_name, Component) => {
    await render(<Component place={full} photoOverlay={<View testID="feature-overlay" />} bodyLeading={<View testID="feature-leading" />} bodyTrailing={<View testID="feature-trailing" />} />)
    expect(within(screen.getByTestId('place-card-photo')).getByTestId('feature-overlay')).toBeTruthy()
    for (const id of ['feature-leading', 'feature-trailing', 'place-card-name', 'place-card-ratings']) expect(within(screen.getByTestId('place-card-body')).getByTestId(id)).toBeTruthy()
  })
})
