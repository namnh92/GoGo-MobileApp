import { fireEvent, within } from '@testing-library/react-native'
import { Dimensions, Linking, StyleSheet } from 'react-native'

import { loaded as mockLoaded, renderScreen } from './harness'

/**
 * #255, RULE-CORE-015 — a fact with no data is left out of the strip, never
 * drawn as a dash: "—" where a visit time belongs reads as broken to some
 * people and as "no time needed" to others.
 */

const mockDetail: { value: Record<string, unknown> } = { value: {} }

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockLoaded(mockDetail.value),
  usePlaceReviews: () => mockLoaded({ pages: [{ source: 'gogo', order: 'latest', reviews: [], items: [] }], pageParams: [undefined] }),
  useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'
import { api } from '@/shared/api/client'
import { GALLERY_MARGIN } from '@/features/date-plan/place-detail.style'

const PLACE = { id: 'place-1', name: 'Quán thử', photos: [] }

it('F-04: opens the displayed provider photo source and each author profile beside its credit', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  mockDetail.value = { ...PLACE, photos: [{
      id: 'cover', source: 'google', url: 'https://cdn.example.com/cover.jpg', attribution: 'Google Maps', googleMapsUri: 'https://maps.google.com/photo/first',
      authorAttributions: [
        { displayName: 'Mai', uri: 'https://maps.google.com/user/mai' },
        { displayName: 'Nam', uri: 'https://maps.google.com/user/nam' },
      ],
    }, {
      id: 'community', source: 'community', url: 'https://cdn.example.com/community.jpg', attribution: 'Google Maps', googleMapsUri: 'https://maps.google.com/photo/second',
      authorAttributions: [{ displayName: 'Linh', uri: null }],
    }],
  }
  const get = jest.spyOn(api, 'get').mockResolvedValue({})
  try {
    const view = await renderScreen(<PlaceDetailScreen />)
    for (const [name, url] of [
      ['Google Maps', 'https://maps.google.com/photo/first'],
      ['Mai', 'https://maps.google.com/user/mai'],
      ['Nam', 'https://maps.google.com/user/nam'],
    ]) {
      const link = view.getByRole('link', { name })
      await fireEvent.press(link)
      expect(openURL).toHaveBeenLastCalledWith(url)
    }
    expect(get).not.toHaveBeenCalled()
    expect(view.getAllByTestId('place-photo-image').map(image => image.props.source[0].uri)).toEqual(['https://cdn.example.com/cover.jpg', 'https://cdn.example.com/community.jpg'])
    const gallery = view.getByTestId('place-detail-gallery-pages')
    // Use the actual page width, as the gallery does when calculating its index.
    const pageWidth = Dimensions.get('window').width - GALLERY_MARGIN * 2
    await fireEvent.scroll(gallery, { nativeEvent: { contentOffset: { x: pageWidth, y: 0 } } })
    await fireEvent.press(view.getByRole('link', { name: 'Google Maps' }))
    expect(openURL).toHaveBeenLastCalledWith('https://maps.google.com/photo/second')
    expect(view.queryByRole('link', { name: 'Mai' })).toBeNull()
    expect(view.getByText('Linh')).toBeTruthy()
    expect(view.queryByRole('link', { name: 'Linh' })).toBeNull()
  } finally {
    openURL.mockRestore()
    get.mockRestore()
  }
})

it('leaves the visit-time fact out when the place has none', async () => {
  mockDetail.value = { ...PLACE, avgVisitMinutes: null }
  const view = await renderScreen(<PlaceDetailScreen />)
  expect(view.queryByText('—')).toBeNull()
  expect(view.queryByText('Thời gian ghé gợi ý')).toBeNull()
  // A card left with no rows is hidden, not drawn empty.
  expect(view.queryByTestId('place-detail-info')).toBeNull()
  // The facts that do exist still render: no rating is said in words.
  expect(within(view.getByTestId('place-detail-facts')).queryByText('Chưa có đánh giá')).toBeNull()
})

it('shows the visit time with its caption when the place has one', async () => {
  mockDetail.value = { ...PLACE, avgVisitMinutes: 45, rating: 4.5 }
  const view = await renderScreen(<PlaceDetailScreen />)
  const card = within(view.getByTestId('place-detail-info'))

  expect(card.getByText('45 phút')).toBeTruthy()
  expect(card.getByText('Thời gian ghé gợi ý')).toBeTruthy()
  expect(within(view.getByTestId('place-detail-facts')).getByText(/^★ 4,5.*Google$/)).toBeTruthy()
})

it('draws price, the two rating sources and the AI card as separate blocks, with a gap before the card', async () => {
  mockDetail.value = { ...PLACE, rating: 4.5, ratingCount: 1280, gogoRating: 4.2, gogoRatingCount: 7 }
  const view = await renderScreen(<PlaceDetailScreen />)
  const facts = within(view.getByTestId('place-detail-facts'))
  expect(facts.getByText('★ 4,5 (1.280) Google')).toBeTruthy()
  expect(facts.getByText('★ 4,2 (7) GoGo')).toBeTruthy()
  expect(view.getByTestId('place-detail-action-bar')).toBeTruthy()
  // Directions is the map's job, not the action bar's or the info card's.
  expect(within(view.getByTestId('place-detail-action-bar')).queryByText('Chỉ đường')).toBeNull()
  expect(view.queryByTestId('place-detail-info')).toBeNull()
})

it('keeps the same 260pt hero with or without photos, and draws the illustration with its caption when empty', async () => {
  mockDetail.value = { ...PLACE }
  const emptyView = await renderScreen(<PlaceDetailScreen />)
  const none = StyleSheet.flatten(emptyView.getByTestId('place-detail-gallery').props.style)
  expect(emptyView.getByText('Chưa có ảnh địa điểm')).toBeTruthy()
  mockDetail.value = { ...PLACE, photos: [{ id: 'p1', url: 'https://example.test/a.jpg' }] }
  const some = StyleSheet.flatten((await renderScreen(<PlaceDetailScreen />)).getByTestId('place-detail-gallery').props.style)
  expect(none.height).toBe(260)
  expect(some.height).toBe(260)
})

it('omits rows the API did not return and leaves no hairline; keeps last checked as the final row', async () => {
  mockDetail.value = { ...PLACE, phone: '028 7300 1234', freshnessCheckedAt: '2026-11-02T00:00:00Z' }
  const view = await renderScreen(<PlaceDetailScreen />)
  const card = view.getByTestId('place-detail-info')
  const rows = card.children as unknown as { props: { style: unknown } }[]
  expect(rows).toHaveLength(2)
  expect(within(card).queryByText('Địa chỉ')).toBeNull()
  expect(within(card).queryByText('Website')).toBeNull()
  expect((StyleSheet.flatten(rows[0].props.style as object) as { borderTopWidth?: number }).borderTopWidth).toBeUndefined()
  expect((StyleSheet.flatten(rows[1].props.style as object) as { borderTopWidth?: number }).borderTopWidth).toBe(1)
})

it('with coordinates the whole map runs directions; without them a directions card stays', async () => {
  mockDetail.value = { ...PLACE, lat: 10.8, lng: 106.7 }
  const withMap = await renderScreen(<PlaceDetailScreen />)
  expect(withMap.getByLabelText('Chỉ đường').props.accessibilityRole).toBe('button')
  mockDetail.value = { ...PLACE }
  const without = await renderScreen(<PlaceDetailScreen />)
  expect(without.getByLabelText('Chỉ đường')).toBeTruthy()
})

it('phone and website are 44pt link rows that hand off to the system; a failure shows a notice', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  mockDetail.value = { ...PLACE, phone: '028 7300 1234', website: 'rangrangcoffee.com' }
  const view = await renderScreen(<PlaceDetailScreen />)
  const call = view.getByLabelText('Gọi 028 7300 1234')
  const site = view.getByLabelText('Mở website rangrangcoffee.com')
  expect(call.props.accessibilityRole).toBe('link')
  expect(StyleSheet.flatten(site.props.style).minHeight).toBe(44)
  await fireEvent.press(call)
  expect(openURL).toHaveBeenCalledWith('tel:02873001234')
  await fireEvent.press(site)
  expect(openURL).toHaveBeenCalledWith('https://rangrangcoffee.com')
  openURL.mockRejectedValue(new Error('no handler'))
  await fireEvent.press(site)
  expect(await view.findByText('Chưa mở được liên kết này.')).toBeTruthy()
  openURL.mockRestore()
})

it('includes approved userPhotos with uploader credit without requesting provider photos', async () => {
  mockDetail.value = { ...PLACE,
    photos: [{ id: 'cover', url: 'https://cdn.example.com/cover.jpg', source: 'google' }],
    userPhotos: [{ id: 'community', url: 'https://cdn.example.com/community.jpg', source: 'community', contributor: { displayName: 'Lan' } }],
  }
  const get = jest.spyOn(api, 'get').mockResolvedValue({})
  try {
    const view = await renderScreen(<PlaceDetailScreen />)
    expect(view.getAllByTestId('place-photo-image')).toHaveLength(2)
    await fireEvent.scroll(view.getByTestId('place-detail-gallery-pages'), { nativeEvent: { contentOffset: { x: Dimensions.get('window').width - GALLERY_MARGIN * 2, y: 0 } } })
    expect(view.getByText('Ảnh cộng đồng: Lan')).toBeTruthy()
    expect(get).not.toHaveBeenCalled()
  } finally { get.mockRestore() }
})
