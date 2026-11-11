import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { ChipVariant } from '../chip.view'
import { themes, type AppTheme } from '../theme'
import { chipRowGap, spacing, touchTarget } from '../tokens'

const flat = (node: { props: { style?: any } }) => StyleSheet.flatten(node.props.style)
const variants: ChipVariant[] = ['default', 'selected', 'disabled', 'info', 'positive', 'warning']
const appearances = ['default', 'discovery', 'mood', 'soft', 'raised'] as const

// Stock Unistyles mocks freeze stylesheet factories at import. Evaluate the real
// factories per theme, as accent-foreground.spec does; native switching is outside Jest.
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
const { Chip } = jest.requireActual<typeof import('../chip.view')>('../chip.view')
const { FollowUps } = jest.requireActual<typeof import('@/features/assistant/follow-ups.view')>('@/features/assistant/follow-ups.view')
afterEach(() => { currentTheme = themes.orange })

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => [1, 3, 5].map(i => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i]!, 0)
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (hi! + 0.05) / (lo! + 0.05)
}

it.each(Object.entries(themes))('keeps idle and selected chip text at AA in every appearance in %s', async (_name, theme) => {
  currentTheme = theme
  const view = await render(<Chip label="Filter" testID="chip" />)
  for (const appearance of appearances) {
    await view.rerender(<Chip label="Filter" testID="chip" appearance={appearance} />)
    const idleFill = flat(screen.getByTestId('chip')).backgroundColor
    expect(contrast(flat(screen.getByText('Filter')).color, idleFill)).toBeGreaterThanOrEqual(4.5)
    await view.rerender(<Chip label="Filter" testID="chip" appearance={appearance} variant="selected" />)
    const selectedFill = flat(screen.getByTestId('chip')).backgroundColor
    expect(selectedFill).not.toBe(idleFill)
    expect(contrast(flat(screen.getByText('Filter')).color, selectedFill)).toBeGreaterThanOrEqual(4.5)
  }
})

function expectPillSizedHost(button: ReturnType<typeof screen.getByRole>) {
  const host = flat(button)
  const pill = button.queryAll(node => node.type === 'View' && flat(node)?.borderRadius === 999)[0]!
  const surface = flat(pill)
  expect(host.alignSelf).toBe('flex-start')
  expect(host.minHeight).toBeUndefined()
  expect(host.minWidth).toBeUndefined()
  expect(host.height).toBeUndefined()
  expect(host.maxHeight).toBeUndefined()
  expect(host.padding).toBeUndefined()
  expect(host.paddingVertical).toBeUndefined()
  expect(host.marginVertical).toBeUndefined()
  const slop = button.props.hitSlop
  expect(surface.height ?? surface.minHeight).toBeGreaterThanOrEqual(32)
  expect((surface.height ?? surface.minHeight) + slop.top + slop.bottom).toBeGreaterThanOrEqual(touchTarget.min)
  // Padding alone guarantees 44pt even before measuring a one-character label.
  expect(2 * surface.paddingHorizontal + slop.left + slop.right).toBeGreaterThanOrEqual(touchTarget.min)
  return surface
}

it.each(appearances)('keeps the %s host pill-sized with a 44pt hit area for every variant', async appearance => {
  const view = await render(<Chip label="A" appearance={appearance} onPress={jest.fn()} />)
  for (const variant of variants) {
    await view.rerender(<Chip label="A" appearance={appearance} variant={variant} onPress={jest.fn()} />)
    const surface = expectPillSizedHost(screen.getByRole('button', { name: 'A', disabled: variant === 'disabled' }))
    const visual = ['default', 'selected'].includes(variant) || appearance === 'raised' && variant === 'disabled' ? appearance : 'default'
    expect(surface.minHeight).toBe(visual === 'mood' ? 36 : ['soft', 'discovery'].includes(visual) ? 44 : 32)
  }
})

it('gives an independent removal action its own 44pt layout target', async () => {
  await render(<Chip label="Place" onRemove={jest.fn()} removeAccessibilityLabel="Remove place" />)
  const remove = flat(screen.getByRole('button', { name: 'Remove place' }))
  expect(remove.minWidth).toBeGreaterThanOrEqual(touchTarget.min)
  expect(remove.minHeight).toBeGreaterThanOrEqual(touchTarget.min)
  expect(remove.width).toBeUndefined()
  expect(remove.height).toBeUndefined()
})

it.each([
  { label: 'Hỏi tiếp', labels: ['Gợi ý khác', 'Xem thêm'] },
  { label: 'Số người', labels: ['3', '4', '5', '6 trở lên'] },
  { label: 'Ngân sách', labels: ['Dưới 300k', '300k–500k', 'Trên 500k'] },
])('keeps $label chips 4pt apart in a wrapping row with 44pt touch targets', async ({ label, labels }) => {
  const onSelect = jest.fn()
  await render(<FollowUps label={label} items={labels.map((label, index) => ({ label, text: String(index), accent: index === 1 }))} onSelect={onSelect} />)
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(labels.length)
  // Walk the rendered parents to the actual flex row. No native Yoga layout
  // runs in Jest: assert 4pt gaps and no invisible host height on either axis.
  let row = buttons[0]!.parent
  while (row && flat(row)?.flexDirection !== 'row') row = row.parent
  expect(row).not.toBeNull()
  expect(flat(row!).flexWrap).toBe('wrap')
  expect(flat(row!).gap).toBe(4)
  expect(flat(row!).height).toBeUndefined()
  expect(flat(row!).maxHeight).toBeUndefined()
  for (const button of buttons) {
    expectPillSizedHost(button)
  }
  await fireEvent.press(buttons[0]!)
  expect(onSelect).toHaveBeenCalledWith('0')
})

it.each(Object.entries(themes))('keeps every variant single-line and selected heavier without a check in %s', async (name, theme) => {
  currentTheme = theme
  const view = await render(<Chip label="Long label" />)
  for (const appearance of appearances) {
    for (const variant of variants) {
      await view.rerender(<Chip label="Long label" testID="chip" variant={variant} appearance={appearance} />)
      const label = screen.getByText('Long label')
      expect(label.props.numberOfLines).toBe(1)
      expect(label.props.ellipsizeMode).toBe('tail')
      expect(flat(label).fontFamily).toBe(variant === 'selected' ? theme.type.introLabel.fontFamily : theme.type.introSmall.fontFamily)
      expect(theme.type.introLabel.fontFamily).not.toBe(theme.type.introSmall.fontFamily)
      expect(screen.getByTestId('chip').props.accessibilityState).toEqual({ selected: variant === 'selected', disabled: variant === 'disabled' })
      expect(screen.queryByText(/✓/)).toBeNull()
      const semantic = {
        disabled: appearance === 'raised' ? [theme.surface.card, theme.text.secondary] : [theme.surface.subtle, theme.text.secondary],
        info: [theme.status.infoSoft, theme.status.infoText],
        positive: [theme.status.successSoft, theme.status.successText],
        warning: [theme.status.warningSoft, theme.status.warningText],
      }
      if (variant in semantic) {
        const [fill, foreground] = semantic[variant as keyof typeof semantic]
        expect(flat(screen.getByTestId('chip')).backgroundColor).toBe(fill)
        expect(flat(label).color).toBe(foreground)
      }
    }
    await view.rerender(<Chip label="Long label" testID="chip" variant="default" appearance={appearance} />)
    const idle = flat(screen.getByTestId('chip')).backgroundColor
    await view.rerender(<Chip label="Long label" testID="chip" variant="selected" appearance={appearance} />)
    expect(flat(screen.getByTestId('chip')).backgroundColor).not.toBe(idle)
  }
})
it.each(appearances)('retains selection when disabled and never dispatches its action in %s', async appearance => {
  const onPress = jest.fn()
  await render(<Chip label="Selected" appearance={appearance} variant="selected" disabled onPress={onPress} />)
  const chip = screen.getByRole('button', { name: 'Selected' })
  expect(chip.props.accessibilityState).toEqual({ selected: true, disabled: true })
  await fireEvent.press(chip)
  expect(onPress).not.toHaveBeenCalled()
})
it('dispatches press and the separate remove action with their accessible labels', async () => {
  const onPress = jest.fn(), onRemove = jest.fn()
  await render(<><Chip label="Filter" onPress={onPress} /><Chip label="About place" onRemove={onRemove} removeAccessibilityLabel="Remove place" /></>)
  await fireEvent.press(screen.getByRole('button', { name: 'Filter' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Remove place' }))
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(onRemove).toHaveBeenCalledTimes(1)
})

// Audit inventory: row geometry is shared even where the row has screen-specific padding.
const chipRows = [
  ['features/create-date/create-location-fields.grid', () => jest.requireActual('@/features/create-date/create-location-fields.style').styles.grid],
  ['features/assistant/follow-ups.chips', () => jest.requireActual('@/features/assistant/follow-ups.style').styles.chips],
  ['features/assistant/proposal-edit.chips', () => jest.requireActual('@/features/assistant/proposal-edit.style').styles.chips],
  ['features/assistant/assistant-place-card.questions', () => jest.requireActual('@/features/assistant/assistant-place-card.style').styles.questions],
  ['features/home/home.moods', () => jest.requireActual('@/features/home/home.style').styles.moods],
  ['features/search/search.sheetOptionRow', () => jest.requireActual('@/features/search/search.style').styles.sheetOptionRow],
  ['features/notifications/notifications.filters', () => jest.requireActual('@/features/notifications/notifications.style').styles.filters],
  ['features/account/profile-defaults.chips', () => jest.requireActual('@/features/account/profile-defaults.style').styles.chips],
  ['features/tabs/profile.interests', () => jest.requireActual('@/features/tabs/profile.style').styles.interests],
  ['features/contributions/my-contributions.filters', () => jest.requireActual('@/features/contributions/my-contributions.style').styles.filters],
  ['features/review/my-reviews.filterRow', () => jest.requireActual('@/features/review/my-reviews.style').styles.filterRow],
  ['features/matching/match-result.reasonChips', () => jest.requireActual('@/features/matching/match-result.style').styles.reasonChips],
  ['features/matching/suggestion-run-notice.constraintRow', () => jest.requireActual('@/features/matching/suggestion-run-notice.style').styles.constraintRow],
  ['features/place-import/contribution-wizard.row', () => jest.requireActual('@/features/place-import/contribution-wizard.style').styles.row],
  ['features/active-date/checkin-sheet.tagRow', () => jest.requireActual('@/features/active-date/checkin-sheet.style').styles.tagRow],
  ['features/active-date/active-date.factRow', () => jest.requireActual('@/features/active-date/active-date.style').styles.factRow],
  ['features/date-plan/place-detail.tagRow', () => jest.requireActual('@/features/date-plan/place-detail.style').styles.tagRow],
  ['features/date-plan/place-reviews.orderRow', () => jest.requireActual('@/features/date-plan/place-reviews.style').styles.orderRow],
  ['features/date-plan/place-report.reasons', () => jest.requireActual('@/features/date-plan/place-report.style').styles.reasons],
  ['features/date-plan/date-plan.stopBadges', () => jest.requireActual('@/features/date-plan/date-plan.style').styles.stopBadges],
  ['features/gogo-room/room-manage.tierRow', () => jest.requireActual('@/features/gogo-room/room-manage.style').styles.tierRow],
  ['features/gogo-room/gogo-room.memberNameRow', () => jest.requireActual('@/features/gogo-room/gogo-room.style').styles.memberNameRow],
  ['features/gogo-room/gogo-room.memberRow', () => jest.requireActual('@/features/gogo-room/gogo-room.style').styles.memberRow],
  ['shared/ui/rating-chips.row', () => jest.requireActual('@/shared/ui/rating-chips.style').styles.row],
  ['shared/ui/rating-chips.compactRow', () => jest.requireActual('@/shared/ui/rating-chips.style').styles.compactRow],
  ['shared/ui/place-card.discoveryTags', () => jest.requireActual('@/shared/ui/place-card.style').styles.discoveryTags],
  ['shared/ui/place-card.photoBadges', () => jest.requireActual('@/shared/ui/place-card.style').styles.photoBadges],
  ['features/place-import/import.chipRow', () => jest.requireActual('@/features/place-import/import.style').styles.chipRow],
  ['features/date-plan/place-detail.ratingRow', () => jest.requireActual('@/features/date-plan/place-detail.style').styles.ratingRow],
  ['features/matching/swipe.tagRow', () => jest.requireActual('@/features/matching/swipe.style').styles.tagRow],
  ['features/assistant/result-card.badges', () => jest.requireActual('@/features/assistant/result-card.style').styles.badges],
] as const

it('backs the app-wide chip gap with the 4pt spacing token', () => {
  expect(chipRowGap).toBe(spacing[1])
  expect(chipRowGap).toBe(4)
})

it('spaces the preference checkbox list with the list spacing token in every theme', () => {
  const { styles } = jest.requireActual<typeof import('@/features/matching/preference.style')>('@/features/matching/preference.style')
  for (const theme of Object.values(themes)) {
    currentTheme = theme
    expect(StyleSheet.flatten(styles.choices).gap).toBe(spacing[2])
  }
})

it.each(chipRows)('%s uses 4pt on both axes in every theme', (_name, getRow) => {
  for (const theme of Object.values(themes)) {
    currentTheme = theme
    const style = StyleSheet.flatten(getRow())
    expect(style.gap).toBe(4)
    expect(style.columnGap ?? style.gap).toBe(4)
    expect(style.rowGap ?? style.gap).toBe(4)
    expect(['space-between', 'space-around', 'space-evenly']).not.toContain(style.justifyContent)
  }
})
