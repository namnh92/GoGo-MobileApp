import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { Text } from '@/shared/ui/text'
import { accents, status, text, type } from '@/shared/ui/tokens'

/**
 * #294. `Text` turns two keys into a style. Under jest the Unistyles mock
 * serves the first registered theme (orange), which is enough to prove the
 * keys resolve against the theme rather than against a copy of the tokens.
 */
const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

describe('Text', () => {
  it('is body / text.primary unless told otherwise', async () => {
    await render(<Text testID="t">Có kèo, đi đâu.</Text>)
    expect(flat('t')).toMatchObject({ ...type.body, color: text.primary })
    expect(screen.getByText('Có kèo, đi đâu.')).toBeTruthy()
  })

  it('takes the whole style from the variant — face, size and line height together', async () => {
    await render(<Text testID="t" variant="title1">Kế hoạch</Text>)
    expect(flat('t')).toMatchObject(type.title1)
    expect(flat('t')).not.toHaveProperty('fontWeight')
  })

  it('reads accent colours from the active theme', async () => {
    await render(<Text testID="t" color="accent.primary">Xem tất cả</Text>)
    expect(flat('t').color).toBe(accents.orange.primary)
  })

  it('resolves every status label colour to its *Text token, never the fill', async () => {
    await render(<Text testID="t" variant="label" color="status.successText">Đang mở</Text>)
    expect(flat('t').color).toBe(status.successText)
    expect(flat('t').color).not.toBe(status.success)
  })

  it('keeps layout style and forwards native text props', async () => {
    await render(
      <Text testID="t" numberOfLines={1} ellipsizeMode="tail" style={{ marginTop: 8, textAlign: 'center' }}>
        Cà phê · Q.3 · 2,1 km
      </Text>,
    )
    const node = screen.getByTestId('t')
    expect(node.props.numberOfLines).toBe(1)
    expect(node.props.ellipsizeMode).toBe('tail')
    expect(flat('t')).toMatchObject({ marginTop: 8, textAlign: 'center', ...type.body })
  })
})
