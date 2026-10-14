import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as SplashScreen from 'expo-splash-screen'
import { Text } from 'react-native'

import '@/shared/i18n'

import * as sentry from '../sentry'
import { RootErrorBoundary } from '../root-error-boundary.view'

/**
 * GoGo-MobileApp#336 (ADR-0011 D-10) — a render error anywhere under the root
 * is reported once as `boundary` and leaves the generic error state on screen,
 * not a blank app; retry mounts the subtree again.
 */

let shouldThrow = true
function Child() {
  if (shouldThrow) throw new Error('render failed')
  return <Text>recovered</Text>
}

let consoleError: jest.SpyInstance
beforeEach(() => {
  shouldThrow = true
  jest.clearAllMocks()
  // React logs every caught render error; the boundary is the point here.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => consoleError.mockRestore())

it('renders the error state, reports the error and lifts the splash', async () => {
  const capture = jest.spyOn(sentry, 'captureError')
  await render(
    <RootErrorBoundary>
      <Child />
    </RootErrorBoundary>,
  )

  expect(screen.getByTestId('root-error-boundary')).toBeOnTheScreen()
  expect(screen.getByText('Có lỗi xảy ra')).toBeOnTheScreen()
  expect(capture).toHaveBeenCalledTimes(1)
  expect(capture).toHaveBeenCalledWith(expect.objectContaining({ message: 'render failed' }), { kind: 'boundary' })
  expect(SplashScreen.hideAsync).toHaveBeenCalled()
})

it('retry mounts the subtree again', async () => {
  await render(
    <RootErrorBoundary>
      <Child />
    </RootErrorBoundary>,
  )
  shouldThrow = false
  await act(async () => {
    fireEvent.press(screen.getByText('Thử lại'))
  })
  expect(screen.getByText('recovered')).toBeOnTheScreen()
  expect(screen.queryByTestId('root-error-boundary')).toBeNull()
})

it('renders children untouched when nothing throws', async () => {
  shouldThrow = false
  await render(
    <RootErrorBoundary>
      <Child />
    </RootErrorBoundary>,
  )
  expect(screen.getByText('recovered')).toBeOnTheScreen()
})
