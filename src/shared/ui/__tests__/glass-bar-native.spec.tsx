import { render, screen } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import { GlassBar } from '@/shared/ui/glass-bar.view'
import { glass } from '@/shared/ui/tokens'

/**
 * #296 F-01 (owner decision 2026-10-02): on iOS 26 system glass the 78 %
 * wash is drawn too, so tab labels never read straight off the content under
 * the glass — contrast does not depend on the blurred layer.
 */
jest.mock('@callstack/liquid-glass', () => {
  const { View } = jest.requireActual('react-native')
  return { isLiquidGlassSupported: true, LiquidGlassView: View }
})

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

describe('GlassBar on system glass', () => {
  const realOS = Platform.OS
  afterEach(() => {
    Platform.OS = realOS
  })

  it('draws the 78 % wash above the native glass', async () => {
    Platform.OS = 'ios'
    await render(<GlassBar testID="bar" />)
    expect(screen.getByTestId('glass-bar-native')).toBeTruthy()
    expect(screen.queryByTestId('glass-bar-blur')).toBeNull()
    expect(flat('glass-bar-wash')).toMatchObject({ backgroundColor: glass.bar.wash })
  })
})
