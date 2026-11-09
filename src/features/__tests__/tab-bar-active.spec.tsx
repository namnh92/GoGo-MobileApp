import { renderRouter, screen } from 'expo-router/testing-library'
import { StyleSheet, View } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'

import '@/shared/i18n'
import TabsLayout from '@/app/(tabs)/_layout'
import { themes, type ThemeName } from '@/shared/ui/theme'
import { fontFamily } from '@/shared/ui/tokens'

jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('@/features/tabs/upcoming-rooms', () => ({ useUpcomingRooms: () => ({ count: 0, more: false, live: false }) }))
jest.mock('@/features/assistant/assistant-entry-layer.view', () => ({ AssistantEntryLayer: () => null }))
jest.mock('@/shared/observability/screen-tag.view', () => ({ screenTagLayout: ({ children }: { children: React.ReactNode }) => children }))

const tabs = [
  { path: '/', label: 'Khám phá', icon: 'home' },
  { path: '/plans', label: 'Kế hoạch', icon: 'calendar' },
  { path: '/saved', label: 'Đã lưu', icon: 'bookmark' },
  { path: '/profile', label: 'Cá nhân', icon: 'user' },
] as const
const EmptyScreen = () => <View />

describe.each(Object.keys(themes) as ThemeName[])('shared tab bar in %s (#575)', name => {
  it.each(tabs)('$path: accent icon and label, consistent weight and selected state', async active => {
    const theme = themes[name]
    // The native-free Unistyles mock reads the first registered theme.
    UnistylesSheet.configure({ themes: { [name]: theme } as typeof themes })
    await renderRouter({
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': EmptyScreen,
      '(tabs)/plans': EmptyScreen,
      '(tabs)/saved': EmptyScreen,
      '(tabs)/profile': EmptyScreen,
    }, { initialUrl: active.path })

    for (const tab of tabs) {
      const selected = tab === active
      expect(screen.getByRole('button', { name: new RegExp(`^${tab.label}, tab,`) }).props.accessibilityState.selected).toBe(selected)
      const color = selected ? theme.accent.text : theme.text.secondary
      const label = screen.getByText(tab.label)
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({
        color,
        fontFamily: fontFamily.semiBold,
        fontSize: theme.type.caption.fontSize,
      })
      // React Navigation mounts both icon states, hiding the inactive layer.
      // Check the visible layer rather than merely finding a filled SVG.
      const icon = screen.getByTestId(`icon-${tab.icon}${selected ? '-filled' : ''}`)
      expect(icon.props.stroke).toBe(color)
      expect(icon.props.fill).toBe(selected ? color : 'none')
    }
  })
})
