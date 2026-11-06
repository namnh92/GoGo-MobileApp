import { act, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Dimensions, PixelRatio, StyleSheet, TextInput, View } from 'react-native'
import { Text, Glyph, ScaledText } from '../text'
import { LabelledInput } from '../labelled-input.view'
import { SearchField } from '../search-field.view'
import { type } from '../tokens'
import { TextInput as AppTextInput } from '../text-input'

const original = Dimensions.get('window')
afterEach(async () => {
  await act(async () => { Dimensions.set({ window: original }) })
  jest.restoreAllMocks()
})

it.each([1.3, 2])('shared text and inputs force fixed host fonts at system fontScale %s', async fontScale => {
  await act(async () => { Dimensions.set({ window: { ...original, fontScale } }) })
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(fontScale)
  const ref = createRef<TextInput>()
  await render(<View>
    <Text testID="app-text" variant="introBody" allowFontScaling>App text</Text>
    <Glyph testID="glyph" size="sm" allowFontScaling>✓</Glyph>
    <ScaledText box={40} kind="initials">AB</ScaledText>
    <LabelledInput label="Labelled input" icon="mail" allowFontScaling ref={ref} />
    <SearchField accessibilityLabel="Search input" allowFontScaling />
    <AppTextInput accessibilityLabel="Shared input" allowFontScaling />
  </View>)
  for (const host of [screen.getByTestId('app-text'), screen.getByTestId('glyph'), screen.getByText('AB'),
    screen.getByLabelText('Shared input'), screen.getByLabelText('Labelled input'), screen.getByLabelText('Search input')]) {
    expect(host.props.allowFontScaling).toBe(false)
  }
  expect(StyleSheet.flatten(screen.getByTestId('app-text').props.style)).toMatchObject(type.introBody)
  expect(ref.current).not.toBeNull()
})
