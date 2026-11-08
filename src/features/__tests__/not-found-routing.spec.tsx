import { Stack } from 'expo-router'
import { renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'

import NotFoundRoute from '@/app/+not-found'

// Use getSegments below; pnpm does not expose Jest's matcher internals to Expo.
jest.mock('expo-router/build/testing-library/expect', () => ({}))

it.each(['/unknown-page', '/stale/link?source=share'])('redirects %s to home without a not-found screen', async initialUrl => {
  const view = renderRouter({
    _layout: () => <Stack />,
    '(tabs)/index': () => <Text>Home</Text>,
    '+not-found': NotFoundRoute,
  }, { initialUrl })
  await view

  await waitFor(() => expect(view.getSegments()).toEqual(['(tabs)']))
  expect(screen.getByText('Home')).toBeTruthy()
  expect(screen.queryByText('Không tìm thấy trang')).toBeNull()
  expect(screen.queryByText('Page not found')).toBeNull()
  expect(screen.queryByText('Unmatched Route')).toBeNull()
})
