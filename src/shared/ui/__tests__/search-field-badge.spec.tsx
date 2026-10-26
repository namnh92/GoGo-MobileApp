import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { Badge } from '@/shared/ui/badge.view'
import { SearchField } from '@/shared/ui/search-field.view'
import { status, surface, text } from '@/shared/ui/tokens'

/** GoGo-MobileApp#381 — SearchField and Badge. */

it('SearchField carries its name and a solid card surface, not a glass wash', async () => {
  await render(<SearchField accessibilityLabel="Tìm địa điểm" placeholder="Tìm quán…" />)
  const input = screen.getByLabelText('Tìm địa điểm')
  const style = StyleSheet.flatten(input.props.style)
  expect(style.backgroundColor).toBe(surface.card)
  expect(style.minHeight).toBeGreaterThanOrEqual(44)
  expect(input.props.placeholderTextColor).toBe(text.secondary)
})

it('Badge is text on its soft tone, never colour alone', async () => {
  await render(<Badge label="Mới" tone="success" />)
  const label = screen.getByText('Mới')
  expect(StyleSheet.flatten(label.props.style).color).toBe(status.successText)
  expect(StyleSheet.flatten(label.parent!.props.style).backgroundColor).toBe(status.successSoft)
})

it('Badge can name itself for context', async () => {
  await render(<Badge label="Mới" accessibilityLabel="Tính năng mới" />)
  expect(screen.getByLabelText('Tính năng mới')).toBeTruthy()
})
