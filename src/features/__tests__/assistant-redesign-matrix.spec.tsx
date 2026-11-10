import { render } from '@/shared/ui/__tests__/query-render'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import i18n from '@/shared/i18n'
import { themes, type AppTheme } from '@/shared/ui/theme'
import { ToastProvider } from '@/shared/ui/toast.view'
import type { AssistantMessage, AssistantProposal, AssistantConversation } from '@/shared/api'
import { scriptedTime } from './scripted-time'

scriptedTime()

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn(), canGoBack: () => true }
let mockSignedIn = true
const mockStatus = jest.fn()
const mockMessages = jest.fn()
const mockHistory = jest.fn()
const mockRefetch = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), Redirect: () => null }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSignedIn ? { status: 'user', session: { kind: 'user', userId: 'u1' } } : { status: 'guest', session: { kind: 'guest', roomId: 'r1' } } }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useAssistantStatus: () => mockStatus(),
  useAssistantMessages: () => mockMessages(),
  useAssistantConversations: () => mockHistory(),
  useOutgoingAssistantMessages: () => [],
  useAssistantReply: () => ({ step: null, connection: null, retry: jest.fn() }),
  useSendAssistantMessage: () => ({ send: jest.fn(), retry: jest.fn() }),
  useStopAssistantReply: () => ({ mutate: jest.fn(), isPending: false }),
  useUploadImage: () => ({ mutate: jest.fn() }),
  useRenameAssistantConversation: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteAssistantConversation: () => ({ mutate: jest.fn(), isPending: false }),
}))

// The library's stock mock freezes styles in the first theme. Evaluate the
// real factories in each theme instead; this does not simulate native switching.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))
const Assistant = jest.requireActual<typeof import('../assistant/assistant.view')>('../assistant/assistant.view').default
const { Conversation } = jest.requireActual<typeof import('../assistant/conversation.view')>('../assistant/conversation.view')
const { History } = jest.requireActual<typeof import('../assistant/history.view')>('../assistant/history.view')
const { ConfirmationCard } = jest.requireActual<typeof import('../assistant/confirmation-card.view')>('../assistant/confirmation-card.view')
const { ResultCard } = jest.requireActual<typeof import('../assistant/result-card.view')>('../assistant/result-card.view')

const states = ['default', 'loading', 'empty', 'error'] as const
type State = typeof states[number]
function query(state: State, items: unknown[] = []) {
  return { isPending: state === 'loading', isError: state === 'error', isSuccess: state !== 'loading' && state !== 'error',
    error: state === 'error' ? new Error('unavailable') : null,
    data: state === 'loading' || state === 'error' ? undefined : { pages: [{ items: state === 'empty' ? [] : items }] },
    refetch: mockRefetch, hasNextPage: false, isFetchingNextPage: false }
}
const noop = () => {}
const message: AssistantMessage = { id: 'm1', conversationId: 'c1', role: 'user', text: 'A real saved question', status: 'complete', createdAt: '2026-11-08T10:00:00Z' }
const conversation: AssistantConversation = { id: 'c1', title: 'A real chat', preview: 'A saved answer', messageCount: 2, expiresAt: '2027-02-08T10:00:00Z', createdAt: '2026-11-08T10:00:00Z', lastMessageAt: '2026-11-08T10:00:00Z' }
const proposal: AssistantProposal = { id: 'p1', kind: 'create_room', status: 'pending', createdAt: '2026-11-08T10:00:00Z', values: [{ field: 'title', value: 'A real room', origin: 'explicit', editable: true }], expiresAt: '2026-11-09T10:00:00Z' }
async function mount(element: React.ReactElement) { await render(<ToastProvider>{element}</ToastProvider>) }

describe.each(['orange', 'orangeDark'] as const)('group 09 %s', themeName => {
  beforeEach(async () => {
    currentTheme = themes[themeName]
    mockSignedIn = true
    mockStatus.mockReset().mockReturnValue({ isSuccess: true, data: { state: 'enabled' } })
    mockMessages.mockReset().mockReturnValue(query('empty'))
    mockHistory.mockReset().mockReturnValue(query('empty'))
    mockRefetch.mockReset()
    await act(async () => { await i18n.changeLanguage('vi') })
  })
  afterEach(async () => { await act(async () => { await i18n.changeLanguage('vi') }) })

  it.each(states)('gate stays locked during %s of the inaccessible account query', async state => {
    mockSignedIn = false
    mockStatus.mockReturnValue({ ...query(state), data: undefined })
    await mount(<Assistant />)
    expect(screen.getByText(i18n.t('assistant.signIn.title'))).toBeTruthy()
    expect(screen.getByTestId('assistant-locked-composer')).toBeTruthy()
    expect(screen.queryByTestId('assistant-input')).toBeNull()
    expect(mockStatus).not.toHaveBeenCalled()
    expect(mockMessages).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('assistant.signIn.cta') }))
    expect(mockRouter.replace).toHaveBeenCalledWith('/auth/sign-in?next=assistant')
    const header = screen.getByTestId('app-header')
    expect(StyleSheet.flatten(header.props.style).backgroundColor).toBe(currentTheme.surface.canvas)
    expect(within(header).getByTestId('assistant-close')).toBeTruthy()
    expect(screen.queryByTestId('app-header-bell')).toBeNull()
  })

  it.each(states)('welcome preserves its composer and starter actions with %s status', async state => {
    mockStatus.mockReturnValue({ ...query(state), data: state === 'default' ? { state: 'enabled' } : undefined })
    await mount(<Assistant />)
    expect(screen.getByTestId('assistant-welcome')).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('assistant-screen').props.style).backgroundColor).toBe(currentTheme.surface.canvas)
    expect(screen.getByTestId('assistant-send')).toBeDisabled()
    expect(screen.getByTestId('assistant-mic')).toBeDisabled()
    expect(screen.getByTestId('assistant-attach')).toBeEnabled()
    expect(screen.queryByText('Online')).toBeNull()
    expect(screen.queryByText(/1\.200/)).toBeNull()
    expect(screen.getByRole('button', { name: /^Khám phá GoGo\./ })).toBeTruthy()
  })

  it.each(states)('conversation %s', async state => {
    mockMessages.mockReturnValue(query(state, [message]))
    await mount(<Conversation conversationId="c1" outgoing={[]} onRetry={noop} step={null} connection={null} onRetryStream={noop} actions={{ onSend: noop, onOpenPlace: noop, onOpenPlan: noop, onOpenRoom: noop }} sendDisabled={false} />)
    if (state === 'loading') expect(screen.getByTestId('assistant-conversation-loading')).toBeTruthy()
    else if (state === 'error') {
      expect(screen.getByText(i18n.t('assistant.error.load.title'))).toBeTruthy()
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('assistant.retry') }))
      expect(mockRefetch).toHaveBeenCalledTimes(1)
    } else {
      expect(screen.getByTestId('assistant-thread')).toBeTruthy()
      expect(screen.queryByText(message.text) !== null).toBe(state === 'default')
      if (state === 'empty') expect(screen.getByText(i18n.t('assistant.conversation.empty.title'))).toBeTruthy()
    }
  })

  it.each(states)('proposal %s renders actual values and preserves confirm/dismiss', async state => {
    const confirm = jest.fn(), dismiss = jest.fn()
    await mount(<ConfirmationCard proposal={{ ...proposal, values: state === 'empty' ? [] : proposal.values }} context={{ locale: 'vi', placeNames: new Map() }} confirming={state === 'loading'} dismissing={false} error={state === 'error' ? new Error('failed') : null} onConfirm={confirm} onDismiss={dismiss} />)
    expect(StyleSheet.flatten(screen.getByTestId('assistant-proposal-p1').props.style).backgroundColor).toBe(currentTheme.surface.card)
    expect(screen.queryByText('A real room') !== null).toBe(state !== 'empty')
    const primary = screen.getByRole('button', { name: state === 'loading' ? i18n.t('assistant.proposal.working') : i18n.t('assistant.proposal.confirm.create_room') })
    if (state === 'loading') {
      expect(primary).toBeDisabled()
      expect(primary.props.accessibilityState.busy).toBe(true)
      expect(screen.getByRole('button', { name: i18n.t('assistant.proposal.notNow') })).toBeDisabled()
    } else {
      if (state === 'error') expect(screen.getByRole('alert')).toBeTruthy()
      await fireEvent.press(primary)
      expect(confirm).toHaveBeenCalledWith(undefined)
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('assistant.proposal.notNow') }))
      expect(dismiss).toHaveBeenCalledTimes(1)
    }
  })

  it.each(states)('history %s keeps search, back and new chat', async state => {
    mockHistory.mockReturnValue(query(state, [conversation]))
    const back = jest.fn(), newChat = jest.fn(), open = jest.fn()
    await mount(<History activeId={null} onBack={back} onOpen={open} onNewChat={newChat} />)
    expect(screen.getByLabelText(i18n.t('assistant.history.search'))).toBeTruthy()
    await fireEvent.press(screen.getByTestId('assistant-back'))
    await fireEvent.press(screen.getByTestId('assistant-history-new-chat'))
    expect(back).toHaveBeenCalledTimes(1)
    expect(newChat).toHaveBeenCalledTimes(1)
    if (state === 'loading') expect(screen.getByTestId('assistant-history-loading')).toBeTruthy()
    if (state === 'empty') expect(screen.getByText(i18n.t('assistant.history.empty.title'))).toBeTruthy()
    if (state === 'error') {
      expect(screen.getByText(i18n.t('assistant.history.error.title'))).toBeTruthy()
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('assistant.retry') }))
      expect(mockRefetch).toHaveBeenCalledTimes(1)
    }
    if (state === 'default') {
      await fireEvent.press(screen.getByRole('button', { name: /^A real chat,/ }))
      expect(open).toHaveBeenCalledWith(conversation)
    }
  })

  it('uses the shared PlaceCard with separate community score, real photo and price unit', async () => {
    const open = jest.fn()
    await mount(<ResultCard card={{ kind: 'place', placeId: 'place1', available: true, facts: { name: 'A verified place', priceMin: 85000, priceMax: 85000, gogoRating: 4.6, gogoRatingCount: 12, photoUrl: 'https://example.com/real.jpg' } }} onOpenPlace={open} onOpenPlan={noop} />)
    expect(screen.getByTestId('place-card')).toBeTruthy()
    expect(screen.getByTestId('place-photo-image').props.source[0].uri).toBe('https://example.com/real.jpg')
    expect(screen.getByText(/85.*\/người/)).toBeTruthy()
    expect(screen.getByText(/GoGo/)).toBeTruthy()
    expect(screen.queryByText(/Google/)).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('assistant.card.viewPlace') }))
    expect(open).toHaveBeenCalledWith('place1')
  })

  it('omits unknown prices and unavailable place actions', async () => {
    await mount(<ResultCard card={{ kind: 'place', placeId: 'place1', available: false, facts: { name: 'Unavailable place' } }} onOpenPlace={noop} onOpenPlan={noop} />)
    expect(screen.queryByTestId('place-card-rating-price')).toBeNull()
    expect(screen.queryByTestId('place-photo-placeholder')).toBeNull()
    expect(screen.queryByRole('button', { name: i18n.t('assistant.card.viewPlace') })).toBeNull()
    expect(screen.getByText(i18n.t('assistant.card.unavailable'))).toBeTruthy()
  })

  it('renders the localized gate and welcome labels in English', async () => {
    await act(async () => { await i18n.changeLanguage('en') })
    mockSignedIn = false
    await mount(<Assistant />)
    expect(screen.getByText('Sign in to use GoGo AI')).toBeTruthy()
    expect(screen.getByText('Review and confirm proposals before saving')).toBeTruthy()
    mockSignedIn = true
    await screen.rerender(<ToastProvider><Assistant /></ToastProvider>)
    expect(screen.getByText(i18n.t('assistant.welcome.helpTitle'))).toBeTruthy()
    expect(screen.getByRole('button', { name: new RegExp(`^${i18n.t('assistant.suggestion.explore.title')}`) })).toBeTruthy()
    await screen.rerender(<ToastProvider><History activeId={null} onBack={noop} onOpen={noop} onNewChat={noop} /></ToastProvider>)
    expect(screen.getByText(i18n.t('assistant.history.empty.title'))).toBeTruthy()
  })
})
