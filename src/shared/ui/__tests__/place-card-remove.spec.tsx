import { render } from './query-render'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import '@/shared/i18n'
import { constrainedTouchTarget } from './touch-target-geometry'
import { themes, type AppTheme } from '../theme'
import type { PlaceCard as PlaceCardModel } from '@/shared/api'

// Evaluate real style factories per theme; the default Jest mock freezes them at import.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => {
  const evaluate = () => typeof factory === 'function' ? factory(currentTheme, runtime) : factory
  return new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
    get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(evaluate(), key),
  })
})
const { PlaceCardSmall } = jest.requireActual<typeof import('../place-card-small.view')>('../place-card-small.view')
const fixture = (): PlaceCardModel => ({ id: 'cafe', name: 'Cafe with a long name', addressText: 'A long verified address', photoUrl: null, photoAttribution: null, photoSource: null, ratingSource: 'google', priceUnit: 'unknown', priceMin: null, priceMax: null, currency: 'VND', priceUncertain: false, isLodging: false, reasonCodes: [] })
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style)

it.each([0, 4, 20])('keeps small-card rating badges on one line with their source and count (%i GoGo reviews)', async count => {
  await render(<PlaceCardSmall place={{ ...fixture(), rating: 4.7, ratingCount: 1280, gogoRating: count >= 5 ? 4.9 : undefined, gogoRatingCount: count }}
    onRemove={() => {}} removeAccessibilityLabel="Remove cafe" />)
  expect(screen.getByTestId('place-gogo-rating')).toHaveTextContent(count >= 5 ? '★ 4,9 (20) GoGo' : `GoGo · ${count} đánh giá`, { exact: true })
  expect(screen.getByTestId('place-google-rating')).toHaveTextContent('★ 4,7 (1.280) Google', { exact: true })
  for (const id of ['place-gogo-rating-source', 'place-gogo-rating-count', 'place-google-rating-score', 'place-google-rating-count', 'place-google-rating-source']) {
    const fact = screen.getByTestId(id)
    expect(fact.props.numberOfLines).toBeUndefined()
    expect(fact.props.ellipsizeMode).toBeUndefined()
    expect(StyleSheet.flatten(fact.props.style).flexShrink).toBe(0)
  }
  for (const id of ['place-gogo-rating', 'place-google-rating']) {
    expect(flat(id).maxWidth).toBe('100%')
    expect(flat(id).flexShrink).toBe(1)
  }
})

it.each(['orange', 'orangeDark'] as const)('round 6t: remove overlaps the corner, frees text width and cannot open (%s)', async themeName => {
  const theme = themes[themeName]
  currentTheme = theme
  try {
    const open = jest.fn(); const remove = jest.fn()
    await render(<PlaceCardSmall place={fixture()} onPress={open} onRemove={remove} removeAccessibilityLabel="Remove cafe" />)
    const button = screen.getByRole('button', { name: 'Remove cafe' })
    const surface = screen.getByTestId('place-card-surface')
    const target = screen.getByTestId('place-card-open-target')
    expect(within(surface).getByRole('button', { name: 'Remove cafe' })).toBe(button)
    expect(within(target).queryByRole('button', { name: 'Remove cafe' })).toBeNull()
    const style = StyleSheet.flatten(button.props.style)
    expect(style).toMatchObject({ position: 'absolute', top: -12, right: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.surface.high, borderWidth: 1, borderColor: theme.border.hairline })
    expect(style.width + button.props.hitSlop.left + button.props.hitSlop.right).toBeGreaterThanOrEqual(44)
    expect(style.height + button.props.hitSlop.top + button.props.hitSlop.bottom).toBeGreaterThanOrEqual(44)
    // Parent bounds clip the exterior half: the inward area alone must be 44pt.
    const targetArea = constrainedTouchTarget(
      { x: 320 - style.right - style.width, y: style.top, width: style.width, height: style.height },
      { x: 0, y: 0, width: 320, height: 120 }, button.props.hitSlop,
    )
    expect(targetArea).toEqual({ width: 44, height: 44 })
    expect(within(button).getByTestId('place-card-remove-glyph').props.width).toBe(14)
    expect(StyleSheet.flatten(surface.props.style).overflow).toBe('visible')
    expect(flat('place-card-body').paddingRight ?? 0).toBe(0)
    await fireEvent.press(button)
    expect(remove).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled()
    await fireEvent.press(target)
    expect(open).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1)
  } finally { currentTheme = themes.orange }
})

it('round 5: callers without remove retain their existing body, name and header actions', async () => {
  const view = await render(<PlaceCardSmall place={fixture()} />)
  expect(screen.queryByTestId('place-card-remove')).toBeNull()
  expect(screen.queryByTestId('icon-plus', { includeHiddenElements: true })).toBeNull()
  expect(screen.queryByText('+', { exact: true })).toBeNull()
  expect(flat('place-card-body').paddingRight).toBeUndefined()
  expect(flat('place-card-name').paddingRight).toBeUndefined()
  await view.rerender(<PlaceCardSmall place={fixture()} headerAction={<View testID="existing-header-action" />} />)
  expect(screen.getByTestId('existing-header-action')).toBeTruthy()
  expect(flat('place-card-name').paddingRight).toBe(22 + themes.orange.spacing[3])
  expect(screen.queryByTestId('place-card-remove')).toBeNull()
})

