import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '../theme'

const options = [{ value: 'upcoming', label: 'Sắp tới' }, { value: 'history', label: 'Lịch sử' }] as const

export function segmentedTabsCases(name: 'orange' | 'orangeDark') {
  const theme = themes[name]
  UnistylesSheet.configure({ themes: { [name]: theme } as unknown as typeof themes })
  const { SegmentedTabs } = jest.requireActual<typeof import('../segmented-tabs.view')>('../segmented-tabs.view')
  afterEach(async () => { await cleanup() })

  it(`preserves Kế hoạch layout and typography in ${name}`, async () => {
    await render(<SegmentedTabs options={options} value="upcoming" onChange={jest.fn()} />)
    expect({
      track: StyleSheet.flatten(screen.getByTestId('segmented-tabs').props.style),
      tabs: screen.getAllByRole('tab').map(tab => {
        const label = tab.props.accessibilityState.selected ? 'Sắp tới' : 'Lịch sử'
        const { color: _color, ...typography } = StyleSheet.flatten(screen.getByText(label).props.style)
        return { surface: StyleSheet.flatten(tab.props.style), typography }
      }),
    }).toMatchSnapshot()
  })

  it('uses theme roles, plain counts (including zero), selected semantics and 44pt targets', async () => {
    const onChange = jest.fn()
    const options = [{ value: 'places', label: 'Địa điểm', count: 8 }, { value: 'reviews', label: 'Đánh giá', count: 0 }]
    const view = await render(<SegmentedTabs options={options} value="places" onChange={onChange} />)
    expect(screen.getByTestId('segmented-tabs').props.accessibilityRole).toBe('tablist')
    expect(StyleSheet.flatten(screen.getByTestId('segmented-tabs').props.style).backgroundColor).toBe(theme.surface.subtle)
    for (const [label, selected] of [['Địa điểm (8)', true], ['Đánh giá (0)', false]] as const) {
      const tab = screen.getByRole('tab', { name: label })
      expect(tab.props.accessibilityState.selected).toBe(selected)
      expect(StyleSheet.flatten(tab.props.style).minHeight).toBeGreaterThanOrEqual(44)
      expect(StyleSheet.flatten(screen.getByText(label).props.style)).toMatchObject({
        ...theme.type[selected ? 'label' : 'bodySmall'], color: selected ? theme.accent.onAccent : theme.text.secondary,
      })
    }
    expect(StyleSheet.flatten(screen.getByRole('tab', { name: 'Địa điểm (8)' }).props.style).backgroundColor).toBe(theme.accent.primary)
    expect(screen.queryByText('8')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
    await fireEvent.press(screen.getByRole('tab', { name: 'Đánh giá (0)' }))
    expect(onChange).toHaveBeenCalledWith('reviews')
    await view.rerender(<SegmentedTabs options={options} value="reviews" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'Đánh giá (0)' }).props.accessibilityState.selected).toBe(true)
    await view.rerender(<SegmentedTabs options={[{ value: 'places', label: 'Địa điểm' }, { value: 'reviews', label: 'Đánh giá', count: '8+' }]} value="places" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'Địa điểm' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Đánh giá (8+)' })).toBeTruthy()
  })
}
