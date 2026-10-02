import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { PlanCard } from '@/shared/ui/plan-card.view'
import { accents, status, surface, text, type } from '@/shared/ui/tokens'

/** #295 — PlanCard per #293 §3: strings in, full title, facts on one wrapping line. */
const LONG_TITLE = 'Kèo cà phê cuối tuần với cả nhóm đại học ở Quận 3'
const META = '2 người · Thành viên · 1/2 đã chọn xong · Thứ Bảy 27/9'

async function renderCard(props: Partial<Parameters<typeof PlanCard>[0]> = {}) {
  const onPress = jest.fn()
  await render(
    <PlanCard
      testID="plan"
      icon="👥"
      title={LONG_TITLE}
      meta={META}
      status={{ label: 'Đang chọn', variant: 'info' }}
      onPress={onPress}
      {...props}
    />,
  )
  return onPress
}

describe('PlanCard', () => {
  it('shows the whole title — never truncated', async () => {
    await renderCard()
    const title = screen.getByTestId('plan-card-title')
    expect(title).toHaveTextContent(LONG_TITLE, { exact: true })
    expect(title.props.numberOfLines).toBeUndefined()
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({ ...type.title2, color: text.primary })
  })

  it('renders the composed facts as one secondary line', async () => {
    await renderCard()
    const meta = screen.getByTestId('plan-card-meta')
    expect(meta).toHaveTextContent(META, { exact: true })
    expect(StyleSheet.flatten(meta.props.style)).toMatchObject({ ...type.bodySmall, color: text.secondary })
  })

  it('lets the screen give the meta facts a spoken form (GoGo-BE#637)', async () => {
    await renderCard({ meta: '4 người · 800k/người', metaAccessibilityLabel: '4 người, Ngân sách 800k mỗi người' })
    const meta = screen.getByTestId('plan-card-meta')
    expect(meta).toHaveTextContent('4 người · 800k/người', { exact: true })
    expect(meta.props.accessibilityLabel).toBe('4 người, Ngân sách 800k mỗi người')
  })

  it('carries the status chip with its label and variant colours', async () => {
    await renderCard()
    const label = screen.getByText('Đang chọn')
    expect(StyleSheet.flatten(label.props.style).color).toBe(status.infoText)
    expect(StyleSheet.flatten(label.parent!.props.style).backgroundColor).toBe(status.infoSoft)
  })

  it('keeps a long status under the facts, never beside them (#298, Kế hoạch at 375pt)', async () => {
    // Beside the column, this chip took most of a 375pt row and the title and
    // meta wrapped one word per line. Inside the column it takes no width from them.
    await renderCard({ status: { label: 'Đang chờ mọi người chọn', variant: 'info' } })
    const column = screen.getByTestId('plan-card-title').parent!
    const chip = screen.getByText('Đang chờ mọi người chọn').parent!
    expect(chip.parent).toBe(column)
    expect(screen.getByTestId('plan-card-meta').parent).toBe(column)
    expect(StyleSheet.flatten(column.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
  })

  it('upcoming: the icon sits on the accent soft circle; past: neutral circle and faded card', async () => {
    await renderCard()
    const circle = () => StyleSheet.flatten(screen.getByText('👥').parent!.props.style)
    expect(circle()).toMatchObject({ width: 48, height: 48, borderRadius: 24, backgroundColor: accents.orange.soft })
    await renderCard({ past: true })
    expect(circle().backgroundColor).toBe(surface.subtle)
    const card = screen.getByText('👥').parent!.parent!
    expect(StyleSheet.flatten(card.props.style).opacity).toBe(0.72)
  })

  it('is one button that opens the plan', async () => {
    const onPress = await renderCard()
    await act(async () => fireEvent.press(screen.getByTestId('plan')))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('plan').props.accessibilityRole).toBe('button')
  })
})
