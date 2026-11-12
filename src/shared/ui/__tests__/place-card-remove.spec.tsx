import { render } from './query-render'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import '@/shared/i18n'
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
  const gogo = screen.getByText(count >= 5 ? '★ 4,9 (20) GoGo' : `GoGo · Chưa đủ đánh giá (${count})`)
  const google = screen.getByText('★ 4,7 (1.280) Google')
  for (const label of [gogo, google]) {
    expect(label.props.numberOfLines).toBe(1)
    expect(label.props.ellipsizeMode).toBe('tail')
    expect(StyleSheet.flatten(label.props.style).flexShrink).toBe(1)
  }
  for (const id of ['place-gogo-rating', 'place-google-rating']) {
    expect(flat(id).maxWidth).toBe('100%')
    expect(flat(id).flexShrink).toBe(1)
  }
})

it.each(['orange', 'orangeDark'] as const)('round 5: optional remove overlays inside the top-right, reserves text and cannot open (%s)', async themeName => {
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
    expect(style).toMatchObject({ position: 'absolute', top: theme.spacing[2], right: theme.spacing[2], width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surface.high })
    expect(button.props.hitSlop).toEqual({ top: 0, right: 0, left: 12, bottom: 12 })
    // The whole text column (including the address) clears the visual and inward target.
    expect(flat('place-card-body').paddingRight).toBeGreaterThanOrEqual(style.width + button.props.hitSlop.left + theme.spacing[2])
    await fireEvent.press(button)
    expect(remove).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled()
    await fireEvent.press(target)
    expect(open).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1)
  } finally { currentTheme = themes.orange }
})

it('round 5: callers without remove retain their existing body, name and header actions', async () => {
  const view = await render(<PlaceCardSmall place={fixture()} />)
  expect(screen.queryByTestId('place-card-remove')).toBeNull()
  expect(flat('place-card-body').paddingRight).toBeUndefined()
  expect(flat('place-card-name').paddingRight).toBeUndefined()
  await view.rerender(<PlaceCardSmall place={fixture()} headerAction={<View testID="existing-header-action" />} />)
  expect(screen.getByTestId('existing-header-action')).toBeTruthy()
  expect(flat('place-card-name').paddingRight).toBe(22 + themes.orange.spacing[3])
  expect(screen.queryByTestId('place-card-remove')).toBeNull()
})

