import { render, screen } from '@testing-library/react-native'

import { MatchingOrbit } from '@/features/matching/matching-orbit.view'

let mockReduced = false
jest.mock('@/shared/ui/feedback', () => ({
  ...jest.requireActual('@/shared/ui/feedback'),
  useReducedMotion: () => mockReduced,
}))

const ping = () => screen.queryByTestId('matching-orbit-ping', { includeHiddenElements: true })

it('moves while the run is going', async () => {
  mockReduced = false
  await render(<MatchingOrbit running />)
  expect(ping()).toBeTruthy()
})

it('rests when nothing is running', async () => {
  mockReduced = false
  await render(<MatchingOrbit running={false} />)
  expect(ping()).toBeNull()
})

it('rests under reduced motion', async () => {
  mockReduced = true
  await render(<MatchingOrbit running />)
  expect(ping()).toBeNull()
})
