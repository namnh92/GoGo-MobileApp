// Exercise the shipped RN functions: their Jest class mocks would incorrectly
// make defaultProps look sufficient on React 19.
jest.unmock('react-native/Libraries/Text/Text')
jest.unmock('react-native/Libraries/Components/TextInput/TextInput')
jest.unmock('react-native/Libraries/Components/Button')
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'hydrating' }) }))

import { act, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Button, Dimensions, PixelRatio, StyleSheet, Text as RNText, TextInput, View } from 'react-native'
import { configureFixedFontScaling } from '../font-scaling'
import { Text } from '../text'
import { LabelledInput } from '../labelled-input.view'
import { SearchField } from '../search-field.view'
import { PrimaryBtn } from '../button.view'
import { type } from '../tokens'
import Splash from '@/features/onboarding/splash.view'
import i18n from '@/shared/i18n'

// Setup configured the host mocks; configure the unmocked native functions now.
configureFixedFontScaling()
const original = Dimensions.get('window')
const flat = (node: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(node.props.style)
const hidden = { includeHiddenElements: true }

afterEach(async () => {
  await act(async () => { Dimensions.set({ window: original }) })
  jest.restoreAllMocks()
})

it.each([1, 1.3, 2])('keeps real Text/TextInput hosts and design tokens fixed at system fontScale %s', async fontScale => {
  await act(async () => { Dimensions.set({ window: { ...original, fontScale } }) })
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(fontScale)
  const ref = createRef<TextInput>()
  await render(<View>
    <Text testID="app-text" variant="introBody">App text</Text>
    <RNText testID="direct-text" allowFontScaling>Third-party / direct text</RNText>
    <TextInput testID="direct-input" allowFontScaling ref={ref} />
    <LabelledInput label="Labelled input" icon="mail" />
    <SearchField accessibilityLabel="Search input" />
    <PrimaryBtn label="App button" onPress={jest.fn()} />
    <Button title="Native button" onPress={jest.fn()} />
    <Splash />
  </View>)
  for (const node of [
    screen.getByTestId('app-text'), screen.getByTestId('direct-text'), screen.getByTestId('direct-input'),
    screen.getByLabelText('Labelled input'), screen.getByLabelText('Search input'),
    screen.getByText('App button'), screen.getByText('Native button'),
    screen.getByText(i18n.t('splash.brand'), hidden), screen.getByText(i18n.t('splash.tagline'), hidden),
  ]) expect(node.props.allowFontScaling).toBe(false)
  expect(flat(screen.getByTestId('app-text'))).toMatchObject(type.introBody)
  expect(flat(screen.getByLabelText('Labelled input'))).toMatchObject({ ...type.introBody, lineHeight: undefined, minHeight: 48 })
  expect(flat(screen.getByText(i18n.t('splash.brand'), hidden))).toMatchObject(type.brand)
  expect(flat(screen.getByText(i18n.t('splash.tagline'), hidden))).toMatchObject(type.introTagline)
  expect(ref.current).not.toBeNull()
  expect(TextInput.State.currentlyFocusedInput).toEqual(expect.any(Function))
})
