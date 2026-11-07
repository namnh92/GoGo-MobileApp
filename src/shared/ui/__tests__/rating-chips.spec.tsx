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
