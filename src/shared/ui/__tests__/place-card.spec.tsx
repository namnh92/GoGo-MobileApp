import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import type { PlaceCard as PlaceCardModel } from '@/shared/api'
import '@/shared/i18n'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { accents, status, text, type } from '@/shared/ui/tokens'

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
  it('renders the four spec lines, exactly, each on one line', async () => {
    await render(<PlaceCard place={fixture()} categoryLabel="Cà phê" />)

    expect(screen.getByTestId('place-card-name').props.numberOfLines).toBe(2)
    expect(screen.getByText('Cà phê Đỗ Phủ')).toBeTruthy()

    expect(screen.getByTestId('place-card-meta')).toHaveTextContent('Cà phê · 12 Nguyễn Huệ · 2,1 km', { exact: true })
    oneLine('place-card-meta')

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

  it('is a padded solid card with a 96pt rounded thumbnail', async () => {
    await render(<PlaceCard place={fixture()} />)
    expect(flat('place-card')).toMatchObject({ padding: 16, flexDirection: 'row' })
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

  it('unknown price says so in words — never an amount without a unit', async () => {
    await render(<PlaceCard place={fixture({ priceMin: null, priceMax: null })} />)
    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('★ 4,6 (980) · Chưa có thông tin giá', { exact: true })
  })

  it('free is the whole price part', async () => {
    await render(<PlaceCard place={fixture({ priceUnit: 'free', priceMin: null, priceMax: null })} />)
    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('★ 4,6 (980) · Miễn phí', { exact: true })
  })

  it('closed: secondary colour and the opening time, in words', async () => {
    await render(<PlaceCard place={fixture({ openNow: false, opensAtMinute: 1020 })} />)
    expect(screen.getByTestId('place-card-open')).toHaveTextContent('Đã đóng · Mở 17:00', { exact: true })
    expect(flat('place-card-open').color).toBe(text.secondary)
  })

  it('unknown open state: the line is omitted', async () => {
    await render(<PlaceCard place={fixture({ openNow: undefined })} />)
    expect(screen.queryByTestId('place-card-open')).toBeNull()
  })

  it('no distance: category · area only', async () => {
    await render(<PlaceCard place={fixture({ distanceM: undefined })} categoryLabel="Cà phê" />)
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent('Cà phê · 12 Nguyễn Huệ', { exact: true })
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

describe('PlaceCard — grid', () => {
  it('shares the same lines', async () => {
    await render(<PlaceCard place={fixture()} variant="grid" categoryLabel="Cà phê" />)
    expect(screen.getByTestId('place-card-rating-price')).toHaveTextContent('★ 4,6 (980) · 45k–90k/người', { exact: true })
    expect(screen.queryByText(/Google/)).toBeNull()
  })
})
