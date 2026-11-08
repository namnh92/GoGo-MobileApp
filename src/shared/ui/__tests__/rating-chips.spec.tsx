import { StyleSheet } from 'react-native-unistyles'
import { themes, type AppTheme } from '../theme'
import { renderScreen } from '../../../features/__tests__/harness'

import { RatingChips } from '../rating-chips.view'

it('shows the Google rating with its count and source, and nothing for GoGo that the API did not return', async () => {
  const view = await renderScreen(<RatingChips place={{ rating: 4.7, ratingCount: 1280, ratingSource: 'google' }} />)
  expect(view.getByText('★ 4,7 (1.280) Google')).toBeTruthy()
  expect(view.getByLabelText('★ 4,7 (1.280) Google')).toBeTruthy()
  expect(view.queryByText('GoGo')).toBeNull()
})

it('renders nothing without a rating', async () => {
  const view = await renderScreen(<RatingChips place={{ rating: undefined, ratingCount: undefined, ratingSource: 'google' }} />)
  expect(view.queryByText('Google')).toBeNull()
})

it('keeps both sources marked with their own counts', async () => {
  const view = await renderScreen(<RatingChips place={{ rating: 4.7, ratingCount: 1280, ratingSource: 'google', gogoRating: 4.9, gogoRatingCount: 20 }} />)
  expect(view.getByText('★ 4,7 (1.280) Google')).toBeTruthy()
  expect(view.getByText('★ 4,9 (20) GoGo')).toBeTruthy()
})

it.each(['orange', 'orangeDark'] as const)('uses finite badge geometry and semantic surfaces (%s)', themeName => {
  const create = jest.spyOn(StyleSheet, 'create')
  let factory: (theme: AppTheme) => Record<string, any>
  try {
    jest.isolateModules(() => { jest.requireActual('../rating-chips.style') })
    factory = create.mock.calls[0][0] as typeof factory
  } finally { create.mockRestore() }
  const theme = themes[themeName]
  const styles = factory!(theme)
  expect(styles.google.backgroundColor).toBe(theme.redesign.container)
  expect(styles.gogo.backgroundColor).toBe(theme.redesign.violetSoft)
  for (const badge of [styles.google, styles.gogo]) expect(Number.isFinite(badge.borderRadius)).toBe(true)
})

it.each(['orange', 'orangeDark'] as const)('detail keeps the Stitch badge geometry and separate source order (%s)', async themeName => {
  const create = jest.spyOn(StyleSheet, 'create')
  let factory: (theme: AppTheme) => Record<string, any>
  try {
    jest.isolateModules(() => { jest.requireActual('../rating-chips.style') })
    factory = create.mock.calls[0][0] as typeof factory
  } finally { create.mockRestore() }
  const styles = factory!(themes[themeName])
  expect(styles.detailBadge).toMatchObject({ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 })
  expect(styles.detailGoogle).toMatchObject({ backgroundColor: themes[themeName].redesign.card, borderWidth: 1, borderColor: themes[themeName].redesign.highest })
  const view = await renderScreen(<RatingChips detail place={{ rating: 4.7, ratingCount: 1280, ratingSource: 'google', gogoRating: 4.9, gogoRatingCount: 20 }} />)
  expect(view.getByTestId('place-card-ratings').children.map(child => typeof child === 'string' ? child : child.props.testID)).toEqual(['place-google-rating', 'place-gogo-rating'])
})
