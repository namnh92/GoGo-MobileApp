import { Stack, router } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import { store } from 'expo-router/build/global-state/router-store'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import CreateLayout, { unstable_settings } from '@/app/create/_layout'
import TypeEntry from '@/app/create/type'
import CreateMood from '../create-mood.view'
import { DraftPlanCard } from '../draft-plan-card.view'
import { saveRoomDraft, useSavedRoomDraft, type DraftStep } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import i18n from '@/shared/i18n'

// Keep the real Expo/React Navigation stacks, actions, layout, header, entry,
// persistence and submit. Unrelated form bodies and remote responses are fixtures.
jest.mock('expo-router/build/testing-library/expect', () => ({}))
jest.mock('../create-type.view', () => ({ __esModule: true, default: () => null }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))
const mockCreate = jest.fn(async () => ({ id: 'created-room', type: 'couple', decisionMode: 'match' }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useTaxonomies: () => ({ data: { kinds: { mood: [], setting: [], spending_style: [] } }, isPending: false, isError: false }),
  useCreateRoom: () => ({ isPending: false, mutateAsync: mockCreate }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
})
afterEach(() => { jest.useRealTimers() })

function Plans() {
  const draft = useSavedRoomDraft(state => state.draft)
  return draft ? <DraftPlanCard draft={draft} /> : <Text>Plans</Text>
}
function rootState() {
  const state = store.navigationRef.current!.getRootState()!
  // Expo's test shell owns an extra __root route above the app's root Stack.
  return state.routes[0].name === '__root' ? state.routes[0].state! : state
}
function wizardState() {
  const root = rootState()
  expect(root.routes.map(route => route.name)).toEqual(['(tabs)', 'create'])
  return root.routes[1].state!
}
async function open(audience: 'couple' | 'group-host', step: DraftStep) {
  useRoomStore.setState({ audience, title: 'Dinner', scheduleDay: '2031-01-14', startTime: '18:15', endTime: '22:45',
    startAt: '2031-01-14T11:15:00Z', endAt: '2031-01-14T15:45:00Z', budgetAmount: 500000 })
  await saveRoomDraft('owner', step)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  await renderRouter({
    _layout: () => <Stack screenOptions={{ headerShown: false }} />,
    '(tabs)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
    '(tabs)/index': Plans,
    'create/_layout': { default: CreateLayout, unstable_settings },
    'create/type': TypeEntry,
    'create/group-setup': () => <Text>Group setup</Text>,
    'create/time': () => <Text>Time</Text>,
    'create/budget': () => <Text>Budget</Text>,
    'create/mood': CreateMood,
    'room/[roomId]': () => <Text>Created room</Text>,
  }, { initialUrl: '/', wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
  await fireEvent.press(screen.getByTestId('plan-card-draft'))
}

it.each([
  ['couple', 'time', ['type', 'time']],
  ['couple', 'budget', ['type', 'time', 'budget']],
  ['couple', 'mood', ['type', 'time', 'budget', 'mood']],
  ['group-host', 'group-setup', ['type', 'group-setup']],
  ['group-host', 'time', ['type', 'group-setup', 'time']],
  ['group-host', 'budget', ['type', 'group-setup', 'time', 'budget']],
  ['group-host', 'mood', ['type', 'group-setup', 'time', 'budget', 'mood']],
  ['couple', 'type', ['type']],
  ['couple', 'location', ['type']],
] as const)('F-13: %s saved at %s opens one root wizard with nested history', async (audience, step, expected) => {
  await open(audience, step)
  expect(wizardState().routes.map(route => route.name)).toEqual(expected)
  expect(wizardState().index).toBe(expected.length - 1)
  for (let index = expected.length - 2; index >= 0; index--) {
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.back') }))
    expect(wizardState().routes.map(route => route.name)).toEqual(expected.slice(0, index + 1))
    expect(wizardState().index).toBe(index)
  }
})

it.each(['save', 'discard', 'header-save'] as const)('F-13: %s removes the entire resumed wizard', async action => {
  await open('group-host', 'budget')
  if (action === 'header-save') await fireEvent.press(screen.getByRole('button', { name: i18n.t('draft.save') }))
  else {
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('draft.close') }))
    await fireEvent.press(screen.getByRole('button', { name: i18n.t(action === 'save' ? 'draft.saveExit' : 'draft.discard') }))
  }
  await waitFor(() => expect(rootState().routes.map(route => route.name)).toEqual(['(tabs)']))
})

it.each(['couple', 'group-host'] as const)('F-13: %s submit replaces the whole resumed wizard; Back returns to Plans', async audience => {
  await open(audience, 'mood')
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('createMood.cta') }))
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(rootState().routes.map(route => route.name)).toEqual(['(tabs)', 'room/[roomId]']))
  expect(useSavedRoomDraft.getState().draft).toBeNull()
  await act(async () => router.back())
  expect(rootState().routes.map(route => route.name)).toEqual(['(tabs)'])
})
