import '@/shared/i18n'

import { render, screen, within } from '@testing-library/react-native'
import { View, StyleSheet } from 'react-native'
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles'

import type { PlaceCard as PlaceCardModel } from '@/shared/api'
import { PlaceCard, type PlaceCardVariant } from '../place-card.view'
import { ThemeScopeProvider } from '../scoped-theme'
import { Text } from '../text'
import { themes, type AppTheme } from '../theme'

jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: undefined }),
  useAdministrativeUnits: () => ({ data: [] }),
}))

// Unistyles' native ScopedTheme mock does not render children. Keep the JS theme scope real.
jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const place: PlaceCardModel = {
  id: 'layout-place', name: 'Place name', addressText: 'Verified street', photoUrl: null, photoAttribution: null, photoSource: null, ratingSource: 'google',
  priceMin: 45000, priceMax: 90000, priceUnit: 'per_person', currency: 'VND', priceUncertain: false,
  openNow: true, closesAtMinute: 1439, distanceM: 800, rating: 4.6, ratingCount: 980,
  gogoRating: 4.9, gogoRatingCount: 142, isLodging: false, reasonCodes: [],
  discovery: { verified: true, categoryLabel: 'Category', tagLabels: ['Tag one', 'Tag two'] },
}

const layouts: [PlaceCardVariant, Record<string, unknown>, boolean][] = [
  ['list', { aspectRatio: 1.6 }, false],
  ['nearby', { width: 80, height: 80 }, true],
  ['saved', { aspectRatio: 16 / 9 }, false],
  ['saved-city', { height: 176 }, false],
  ['contribution', { height: 176 }, false],
  ['assistant', { aspectRatio: 1.6 }, false],
  ['plan-stop', { height: 160 }, false],
  ['plan-edit', { width: 64, height: 64 }, true],
  ['active', { height: 208 }, false],
  ['next-stop', { width: 80, height: 80 }, true],
  ['swipe', { aspectRatio: (4 / 5) / 0.58 }, false],
  ['match', { aspectRatio: 1.6 }, false],
  ['match-group', { aspectRatio: 1.6 }, false],
  ['shared-result', { aspectRatio: 4 / 5 }, false],
  ['hero', { height: 260 }, false],
  ['compact', { width: 80, height: 80 }, true],
]

type TestInstance = ReturnType<typeof screen.getByTestId>
function descendants(node: TestInstance): TestInstance[] {
  return [node, ...node.children.flatMap(child => typeof child === 'string' ? [] : descendants(child))]
}

function styleFactory() {
  const create = jest.spyOn(UnistylesStyleSheet, 'create')
  try {
    jest.isolateModules(() => { jest.requireActual('../place-card.style') })
    return create.mock.calls[0][0] as (theme: AppTheme) => Record<string, any>
  } finally { create.mockRestore() }
}

/** Order/ownership assertions, not colour snapshots. Native text fit still needs a device. */
describe.each(['orange', 'orangeDark'] as const)('#564 PlaceCard layout in %s', themeName => {
  it.each(layouts)('%s keeps its media geometry, reading order and fact ownership', async (variant, geometry, row) => {
    await render(<ThemeScopeProvider name={themeName}><PlaceCard place={place} variant={variant}
      photoOverlay={<View testID="feature-photo-control" />}
      bodyLeading={<Text testID="feature-leading">Stop order</Text>}
      bodyTrailing={<Text testID="feature-trailing">Arrival time</Text>} /></ThemeScopeProvider>)
    const photo = screen.getByTestId('place-card-photo')
    const body = screen.getByTestId('place-card-body')
    expect(StyleSheet.flatten(photo.props.style)).toMatchObject(geometry)
    expect(photo.parent!.children.indexOf(photo)).toBeLessThan(photo.parent!.children.indexOf(body))
    expect(StyleSheet.flatten(photo.parent!.props.style)?.flexDirection).toBe(row ? 'row' : undefined)
    expect(within(photo).getByTestId('feature-photo-control')).toBeTruthy()
    const overlay = variant === 'plan-stop' || variant === 'hero'
    expect(within(overlay ? photo : body).getByTestId('place-card-name')).toBeTruthy()
    if (variant === 'plan-edit') expect(screen.queryByTestId('place-card-meta')).toBeNull()
    else expect(within(variant === 'assistant' ? photo : overlay ? photo : body).getByTestId('place-card-meta')).toBeTruthy()
    const bodyIds = descendants(body).map(node => node.props.testID)
    expect(bodyIds.indexOf('feature-leading')).toBeLessThan(bodyIds.indexOf('feature-trailing'))
    if (!overlay) expect(bodyIds.indexOf('feature-leading')).toBeLessThan(bodyIds.indexOf('place-card-name'))
    const lean = ['contribution', 'plan-edit', 'shared-result'].includes(variant)
    if (lean) {
      if (variant !== 'plan-edit') expect(screen.queryByTestId('place-card-ratings')).toBeNull()
      else expect(screen.getByTestId('place-card-ratings')).toBeTruthy()
      expect(screen.queryByTestId('place-card-price')).toBeNull()
      expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
    } else {
      const ratings = screen.getByTestId('place-card-ratings')
      expect(ratings.children.map(child => typeof child === 'string' ? child : child.props.testID)).toEqual(['place-google-rating', 'place-gogo-rating'])
      expect(bodyIds.indexOf('place-card-ratings')).toBeLessThan(bodyIds.indexOf('feature-trailing'))
    }
    if (variant === 'nearby') {
      expect(within(body).getByTestId('place-card-verified')).toBeTruthy()
      expect(within(photo).getByText('800 m')).toBeTruthy()
      expect(screen.queryByTestId('place-card-hours-badge')).toBeNull()
      expect(screen.queryByText('Category')).toBeNull()
      expect(screen.queryByTestId('place-card-tags')).toBeNull()
      expect(bodyIds.indexOf('place-card-ratings')).toBeLessThan(bodyIds.indexOf('place-card-price'))
      expect(StyleSheet.flatten(body.props.style)).toMatchObject({ padding: 0, minWidth: 0, flex: 1 })
    }
    if (variant === 'saved-city') {
      expect(within(screen.getByTestId('place-card-taxonomy-row')).getByTestId('place-card-price')).toBeTruthy()
      expect(within(photo).getByText('Category')).toBeTruthy()
    }
    if (variant === 'saved') {
      expect(within(screen.getByTestId('place-card-rating-price-row')).getByTestId('place-card-price')).toBeTruthy()
      expect(StyleSheet.flatten(screen.getByTestId('place-card-photo-badges').props.style)).toMatchObject({ top: 10 })
    }
    // Text follows the selected theme scope, including a Dark render, without per-screen palettes.
    expect(StyleSheet.flatten(screen.getByTestId('place-card-name').props.style).color).toBe(overlay || variant === 'shared-result' ? themes[themeName].text.inverse : themes[themeName].redesign.ink)
  })

  it.each(['list', 'saved', 'saved-city', 'active', 'swipe', 'match'] as const)('%s wraps status text instead of truncating it', async variant => {
    await render(<ThemeScopeProvider name={themeName}><PlaceCard variant={variant} place={place} style={{ width: 288 }} /></ThemeScopeProvider>)
    const label = screen.getByText('Mở đến 23:59')
    expect(label.props.numberOfLines).toBeUndefined()
    expect(label.props.ellipsizeMode).toBeUndefined()
    const styles = styleFactory()(themes[themeName])
    expect(styles.photoBadge).toMatchObject({ flexShrink: 0, maxWidth: '100%' })
    expect(styles.photoBadgeText).toMatchObject({ flexShrink: 1, minWidth: 0 })
  })

  it('keeps the unavailable assistant text-only when there is no verified image', async () => {
    await render(<ThemeScopeProvider name={themeName}><PlaceCard variant="assistant" place={place} showPhoto={false} /></ThemeScopeProvider>)
    expect(screen.queryByTestId('place-card-photo')).toBeNull()
    expect(within(screen.getByTestId('place-card-body')).getByTestId('place-card-meta')).toBeTruthy()
  })

  it('omits the assistant address pill entirely when the address is absent', async () => {
    await render(<PlaceCard variant="assistant" place={{ ...place, addressText: undefined }} />)
    expect(screen.queryByTestId('place-card-address-row')).toBeNull()
  })

  it('resolves shared surfaces and compact geometry in both modes', () => {
    const styles = styleFactory()(themes[themeName])
    expect(styles.discoveryCard.backgroundColor).toBe(themes[themeName].redesign.card)
    expect(styles.factTag).toMatchObject({ paddingVertical: 4, paddingHorizontal: 10 })
    expect(styles.factTag.minHeight).toBeUndefined()
    expect(styles.rowSurface).toMatchObject({ padding: 8, borderRadius: 16 })
    expect(styles.thumbnailPhoto).toMatchObject({ width: 80, height: 80 })
    // Provider preview is a separate shared branch, retained by #564.
    expect(styles.compactPhoto).toMatchObject({ width: 48, height: 48 })
    expect(styles.compactRow.flexDirection).toBe('row')
    expect(styles.listPhoto.aspectRatio).toBe(1.6)
    expect(styles.importBody).toMatchObject({ padding: 16, gap: 12 })
  })
})

describe('#564 legacy regression', () => {
  it('keeps a compact thumbnail at 80 by 80 instead of 96 by 192', async () => {
    await render(<PlaceCard variant="compact" place={place} />)
    const photo = screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true }).parent!
    expect(StyleSheet.flatten(photo.props.style)).toMatchObject({ width: 80, height: 80 })
  })
  it('does not ellipsize the closing time in a narrow card', async () => {
    await render(<PlaceCard place={place} style={{ width: 288 }} />)
    const label = screen.getByText('Mở đến 23:59')
    expect(label.props.numberOfLines).toBeUndefined()
    expect(label.props.ellipsizeMode).toBeUndefined()
  })
})
