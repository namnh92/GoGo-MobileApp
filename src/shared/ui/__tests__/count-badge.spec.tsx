import { render, screen } from '@testing-library/react-native'

import { badgeLabel, CountBadge } from '@/shared/ui/count-badge.view'

describe('badgeLabel', () => {
  it.each([
    [1, false, '1'],
    [3, true, '3+'],
    [9, false, '9'],
    [10, false, '9+'],
    [25, true, '9+'],
  ])('%i more=%s reads %s', (count, more, label) => {
    expect(badgeLabel(count, more)).toBe(label)
  })
})

describe('CountBadge', () => {
  it('renders nothing at zero', async () => {
    await render(<CountBadge count={0} />)
    expect(screen.queryByTestId('count-badge-count')).toBeNull()
  })

  it('marks live with its own tone', async () => {
    await render(<CountBadge count={1} tone="live" />)
    expect(screen.getByTestId('count-badge-live', { includeHiddenElements: true })).toBeTruthy()
  })
})
