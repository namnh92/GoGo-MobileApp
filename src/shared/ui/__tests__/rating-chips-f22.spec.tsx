import { act, screen } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'

import i18n from '@/shared/i18n'
import { RatingChips } from '../rating-chips.view'
import { PlaceCardSmall } from '../place-card-small.view'
import { detailToPlaceCard } from '@/shared/api'
import { render } from './query-render'

const place = detailToPlaceCard({ id: 'seed', name: 'Seed café', rating: 4.5, ratingCount: 1395, gogoRatingCount: 0 })
// Jest cannot measure native glyphs. These assertions protect the flex/ellipsis
// contract at the narrow loop-card width; device visual QA is still required.
const loopWidth = (390 - 2 * 16) * 0.8

afterEach(async () => { await act(async () => { await i18n.changeLanguage('vi') }) })

function fixedFact(id: string, text: string) {
  const node = screen.getByTestId(id)
  expect(node).toHaveTextContent(text, { exact: true })
  expect(node.props.numberOfLines).toBeUndefined()
  expect(node.props.ellipsizeMode).toBeUndefined()
  expect(StyleSheet.flatten(node.props.style).flexShrink).toBe(0)
}

describe.each(['vi', 'en'] as const)('F-22 fixed rating facts (%s)', locale => {
  it.each([0, 1, 3, 4])('uses plural-aware compact copy for %i reviews, with only words shrinkable', async count => {
    await act(async () => { await i18n.changeLanguage(locale) })
    const translate = jest.spyOn(i18n, 't')
    try {
      await render(<View style={{ width: loopWidth }}><PlaceCardSmall place={{ ...place, gogoRating: 4.9, gogoRatingCount: count }}
        onRemove={() => {}} removeAccessibilityLabel="Remove seed" /></View>)
      const words = locale === 'vi' ? 'đánh giá' : count === 1 ? 'review' : 'reviews'
      expect(screen.getByTestId('place-gogo-rating')).toHaveTextContent(`GoGo · ${count} ${words}`, { exact: true })
      expect(translate).toHaveBeenCalledWith('discovery.gogoFewReviewsCompact', expect.objectContaining({ count }))
      fixedFact('place-gogo-rating-source', 'GoGo ·')
      fixedFact('place-gogo-rating-count', String(count))
      const status = screen.getByTestId('place-gogo-rating-status')
      expect(status).toHaveTextContent(words, { exact: true })
      expect(status.props.numberOfLines).toBe(1)
      expect(status.props.ellipsizeMode).toBe('tail')
      expect(StyleSheet.flatten(status.props.style)).toMatchObject({ flexShrink: 1, minWidth: 0 })
      expect(screen.queryByTestId('place-gogo-rating-score')).toBeNull()
      const texts = screen.getByTestId('place-gogo-rating').children.filter(child => typeof child !== 'string')
      expect(texts.filter(node => StyleSheet.flatten(node.props.style).flexShrink !== 0)).toEqual([status])
      // Independent flex siblings, never children of an ellipsized Text.
      expect(status.parent).toBe(screen.getByTestId('place-gogo-rating'))
      for (const id of ['source', 'count']) expect(screen.getByTestId(`place-gogo-rating-${id}`).parent).toBe(status.parent)
    } finally { translate.mockRestore() }
  })

  it.each([false, true])('keeps the Google score, sample and mark untruncated (compact=%s)', async compact => {
    await act(async () => { await i18n.changeLanguage(locale) })
    await render(<View style={{ width: loopWidth }}><RatingChips place={place} compact={compact} /></View>)
    fixedFact('place-google-rating-score', locale === 'vi' ? '★ 4,5' : '★ 4.5')
    fixedFact('place-google-rating-count', locale === 'vi' ? '(1.395)' : '(1,395)')
    fixedFact('place-google-rating-source', 'Google')
    const badge = screen.getByTestId('place-google-rating')
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap' })
    for (const id of ['score', 'count', 'source']) expect(screen.getByTestId(`place-google-rating-${id}`).parent).toBe(badge)
  })

  it.each([false, true])('preserves the longer below-threshold wording (detail=%s)', async detail => {
    await act(async () => { await i18n.changeLanguage(locale) })
    await render(<RatingChips place={place} detail={detail} />)
    expect(screen.getByTestId('place-gogo-rating')).toHaveTextContent(locale === 'vi' ? 'GoGo · Chưa đủ đánh giá (0)' : 'GoGo · Not enough reviews (0)', { exact: true })
    fixedFact('place-gogo-rating-source', 'GoGo ·')
    fixedFact('place-gogo-rating-count', '(0)')
  })

  it('protects the scored GoGo sample and source too', async () => {
    await act(async () => { await i18n.changeLanguage(locale) })
    await render(<RatingChips compact place={{ ...place, gogoRating: 4.8, gogoRatingCount: 20 }} />)
    fixedFact('place-gogo-rating-score', locale === 'vi' ? '★ 4,8' : '★ 4.8')
    fixedFact('place-gogo-rating-count', '(20)')
    fixedFact('place-gogo-rating-source', 'GoGo')
    expect(screen.queryByTestId('place-gogo-rating-status')).toBeNull()
  })
})
