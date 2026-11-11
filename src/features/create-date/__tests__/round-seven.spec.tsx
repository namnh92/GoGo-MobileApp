import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import type { ComponentType } from 'react'
import { loaded as mockLoaded, renderScreen } from '../../__tests__/harness'
import { useRoomStore } from '@/shared/store/roomStore'
import { useAppAreaStore } from '@/shared/location/app-area'
import CreateType from '../create-type.view'
import GroupSetup from '../group-setup.view'
import CreateTime from '../create-time.view'
import CreateBudget from '../create-budget.view'
import CreateMood from '../create-mood.view'

let mockStep = 'type'
const mockBack = jest.fn()
const mockDismiss = jest.fn()
const mockSave = jest.fn(async (_owner: string, _step: string) => {})
const mockClear = jest.fn(async () => {})
jest.mock('expo-router', () => ({
  useSegments: () => ['create', mockStep],
  useRouter: () => ({ back: mockBack, dismissTo: mockDismiss, push: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(callback, [callback])
  },
  Stack: Object.assign(({ screenOptions }: { screenOptions: unknown }) => {
    const React = jest.requireActual<typeof import('react')>('react')
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return React.createElement(View, { testID: 'nested-stack', accessibilityValue: { text: JSON.stringify(screenOptions) } }, React.createElement(mockScreens[mockStep]))
  }, { Screen: () => null }),
}))
const mockScreens: Record<string, ComponentType> = { type: CreateType, 'group-setup': GroupSetup, time: CreateTime, budget: CreateBudget, mood: CreateMood }
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))
jest.mock('@/shared/store/savedRoomDraft', () => ({ saveRoomDraft: (owner: string, step: string) => mockSave(owner, step), clearSavedRoomDraft: () => mockClear() }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({ homeAdministrativeArea: null, usualBudget: null }),
  useTaxonomies: () => mockLoaded({ kinds: { mood: [], setting: [], spending_style: [] } }),
  useCreateRoom: () => ({ isPending: false, mutateAsync: jest.fn() }),
}))
jest.mock('@/shared/location/use-current-location', () => ({ useCurrentLocation: () => ({ state: { status: 'idle' }, refresh: async () => undefined }) }))
jest.mock('@/shared/administrative/queries', () => ({ useAdministrativeVersion: () => mockLoaded({ datasetVersion: 'ds' }), useAdministrativeUnits: () => mockLoaded([]) }))

function layout(): ComponentType {
  const path = resolve(__dirname, '../../../app/create/_layout.tsx')
  expect(existsSync(path)).toBe(true)
  return jest.requireActual(path).default
}
beforeEach(() => {
  jest.clearAllMocks()
  mockStep = 'type'
  useRoomStore.getState().resetDraft()
  useAppAreaStore.setState({ area: null, manual: false, scope: { status: 'resolving' }, location: { status: 'idle' } })
})

it.each(['couple', 'group-host'] as const)('round 7: layout retains the same header/actions instance across %s steps while progress updates', async audience => {
  useRoomStore.getState().setAudience(audience)
  const Layout = layout()
  const view = await renderScreen(<Layout />)
  const chrome = view.getByTestId('wizard-chrome')
  const actions = within(chrome).getByRole('button', { name: 'Đóng' })
  const steps = audience === 'couple' ? ['type', 'time', 'budget', 'mood'] : ['type', 'group-setup', 'time', 'budget', 'mood']
  for (const [index, step] of steps.entries()) {
    mockStep = step
    await view.rerender(<Layout />)
    expect(view.getAllByTestId('wizard-chrome')).toHaveLength(1)
    expect(view.getByTestId('wizard-chrome')).toBe(chrome)
    expect(within(chrome).getByRole('button', { name: 'Đóng' })).toBe(actions)
    expect(within(chrome).getByText(`Bước ${index + 1} / ${steps.length}`)).toBeTruthy()
    expect(within(view.getByTestId('nested-stack')).queryByTestId('wizard-chrome')).toBeNull()
    expect(JSON.parse(view.getByTestId('nested-stack').props.accessibilityValue.text).headerShown).toBe(false)
    expect(view.getByTestId('wizard-progress-fill', { includeHiddenElements: true })).toBeTruthy()
    expect(view.getByTestId('create-footer')).toBeTruthy()
  }
  expect(within(chrome).getByTestId('app-header-bell')).toBeTruthy()
})
it.each(['type', 'group-setup', 'time', 'budget', 'mood'])('round 7: %s renders only content and its footer', async step => {
  const Screen = mockScreens[step]
  const view = await renderScreen(<Screen />)
  expect(view.queryByTestId('wizard-chrome')).toBeNull()
  expect(view.getByTestId('wizard-content')).toBeTruthy()
  expect(view.getByTestId('create-footer')).toBeTruthy()
})
it('round 7: nested back pops a step, first back exits an untouched wizard', async () => {
  const Layout = layout()
  mockStep = 'time'
  const view = await renderScreen(<Layout />)
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(mockDismiss).not.toHaveBeenCalled()
  mockStep = 'type'
  await view.rerender(<Layout />)
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(mockDismiss).toHaveBeenCalledWith('/(tabs)')
})
it.each(['Tiếp tục sửa', 'Bỏ bản nháp', 'Lưu nháp và thoát'])('round 7: first-step back uses the exit prompt: %s', async choice => {
  useRoomStore.getState().patchDraft({ title: 'Weekend' })
  const Layout = layout()
  const view = await renderScreen(<Layout />)
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(view.getByTestId('wizard-exit-prompt')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: choice }))
  expect(mockBack).not.toHaveBeenCalled()
  if (choice === 'Tiếp tục sửa') expect(mockDismiss).not.toHaveBeenCalled()
  else await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('/(tabs)'))
  if (choice === 'Lưu nháp và thoát') expect(mockSave).toHaveBeenCalledWith('owner', 'type')
  if (choice === 'Bỏ bản nháp') expect(mockClear).toHaveBeenCalled()
})
it('round 7: Android hardware back on step 1 uses the exit prompt', async () => {
  const listener = jest.spyOn(BackHandler, 'addEventListener')
  useRoomStore.getState().patchDraft({ title: 'Weekend' })
  const Layout = layout()
  const view = await renderScreen(<Layout />)
  const back = listener.mock.calls.find(call => call[0] === 'hardwareBackPress')![1]
  await act(async () => { expect(back()).toBe(true) })
  expect(view.getByTestId('wizard-exit-prompt')).toBeTruthy()
  listener.mockRestore()
})
it('round 7: direct deep links initialise a type screen for nested back', () => {
  layout()
  const path = resolve(__dirname, '../../../app/create/_layout.tsx')
  expect(jest.requireActual(path).unstable_settings.initialRouteName).toBe('type')
})
it('round 7: the persistent Save action uses the updated route step', async () => {
  const Layout = layout()
  const view = await renderScreen(<Layout />)
  mockStep = 'mood'
  await view.rerender(<Layout />)
  await fireEvent.press(view.getByRole('button', { name: 'Lưu nháp' }))
  await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('/(tabs)'))
  expect(mockSave).toHaveBeenCalledWith('owner', 'mood')
})
