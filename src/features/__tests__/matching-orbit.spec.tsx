import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

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

const rotation = (id: string) => {
  const style = StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style)
  const entry = (style.transform ?? []).find((t: Record<string, unknown>) => 'rotate' in t)
  return entry ? String(entry.rotate) : undefined
}

it('keeps the ring at rest when nothing is running', async () => {
  mockReduced = false
  await render(<MatchingOrbit running={false} />)
  expect(rotation('matching-orbit-ring')).toBe('0deg')
})

it('keeps the ring at rest under reduced motion', async () => {
  mockReduced = true
  await render(<MatchingOrbit running />)
  expect(rotation('matching-orbit-ring')).toBe('0deg')
})

describe('while running', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('turns the ring evenly and keeps each bubble upright', async () => {
    mockReduced = false
    await render(<MatchingOrbit running />)
    const rotate = (id: string) => {
      const style = getAnimatedStyle(screen.getByTestId(id, { includeHiddenElements: true })) as {
        transform: { rotate?: string }[]
      }
      return parseFloat(style.transform.find(t => t.rotate !== undefined)?.rotate ?? 'NaN')
    }
    await act(async () => { jest.advanceTimersByTime(750) })
    const quarter = rotate('matching-orbit-ring')
    await act(async () => { jest.advanceTimersByTime(750) })
    const half = rotate('matching-orbit-ring')
    // SPIN_MS is 3000: a quarter, then a half turn, so the speed is even.
    expect(quarter).toBeGreaterThan(75)
    expect(quarter).toBeLessThan(105)
    expect(half).toBeGreaterThan(165)
    expect(half).toBeLessThan(195)
    expect(rotate('matching-orbit-bubble-mapPin')).toBeCloseTo(-half, 3)
  })
})
