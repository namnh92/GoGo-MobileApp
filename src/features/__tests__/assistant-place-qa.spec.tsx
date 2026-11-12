import { act, fireEvent, waitFor, within } from '@testing-library/react-native'

import AssistantRoute from '@/app/assistant'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'
import { setAssistantBackend } from '@/shared/api/assistant-backend'
import { NetworkError } from '@/shared/api/errors'
import type { AssistantFollowUpGroup, AssistantPlaceCard } from '@/shared/api'
import i18n from '@/shared/i18n'

import { callsTo, renderAssistant, resetAssistantSpecState, settle, spyOn, syncTanstackNotifications } from './assistant-harness'

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useRouter: () => mockRouter, useLocalSearchParams: () => ({}), Redirect: () => null }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }) }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))
const mockUuid = { next: 0 }
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid.next).padStart(12, '0')}` }))

syncTanstackNotifications()

const REPLY_ID = '00000000-0000-4000-8000-000000000652'
const card: AssistantPlaceCard = { kind: 'place', placeId: 'place-652', available: true, facts: { name: 'Verified café' } }
const group = (field = 'place_choice', id: string | null = 'pick_1'): AssistantFollowUpGroup => ({
  field, label: 'Server prompt', options: [{ ...(id ? { id } : {}), label: 'This café', text: 'Tell me about this café' }],
})

beforeEach(async () => {
  resetAssistantSpecState()
  mockRouter.push.mockReset()
  await i18n.changeLanguage('vi')
})
afterAll(async () => { await i18n.changeLanguage('vi') })

async function openReply(groups: AssistantFollowUpGroup[], cards: AssistantPlaceCard[] = []) {
  const backend = createMockAssistantBackend({ speed: 0, actor: () => 'user' })
  backend.listMessages = async conversationId => ({
    conversationCredits: { creditsUsed: 0, creditsReserved: 0, pendingTurns: 0, state: 'settled', asOf: '2026-11-12T00:00:00Z' },
    nextCursor: null,
    items: [{ id: REPLY_ID, conversationId, role: 'assistant', status: 'complete', text: 'Verified reply',
      createdAt: '2026-11-12T00:00:00Z', followUps: groups, cards }],
  })
  const spied = spyOn(backend)
  setAssistantBackend(spied)
  const view = await renderAssistant(<AssistantRoute />)
  await act(async () => { await fireEvent.press(await view.findByTestId('assistant-history')) })
  await act(async () => { await fireEvent.press(await view.findByText('Quán cà phê yên tĩnh ở Quận 3')) })
  await view.findByText('Verified reply')
  return { view, backend: spied }
}

it.each([
  ['vi', 'place_choice', 'Chọn địa điểm'], ['en', 'place_choice', 'Choose a place'],
  ['vi', 'place_confirm', 'Xác nhận địa điểm'], ['en', 'place_confirm', 'Confirm a place'],
  ['vi', 'place_topic', 'Thông tin khác'], ['en', 'place_topic', 'More information'],
])('%s renders the %s header and chip accessibility label', async (locale, field, label) => {
  await i18n.changeLanguage(locale)
  const { view } = await openReply([group(field)])
  expect(view.getByText(label)).toBeTruthy()
  expect(view.getByRole('button', { name: `${label} This café` })).toBeEnabled()
  expect(view.queryByText('Server prompt')).toBeNull()
})

it.each(['date', 'future_group', 'constructor'])('keeps the server header for other group %s', async field => {
  const { view } = await openReply([group(field)])
  expect(view.getByText('Server prompt')).toBeTruthy()
})

it.each([true, false])('a chip sends its source and option together only when it has an id (%s)', async hasId => {
  const selected = group('place_choice', hasId ? 'pick_1' : null)
  const { view, backend } = await openReply([selected])
  await act(async () => { await fireEvent.press(view.getByRole('button', { name: 'Chọn địa điểm This café' })) })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(1))
  const body = callsTo(backend, 'sendMessage')[0]![1]
  expect(body).toEqual({ text: selected.options[0]!.text, locale: 'vi',
    ...(hasId ? { replyToMessageId: REPLY_ID, followUpOptionId: 'pick_1' } : {}) })
  await settle()
})

it.each([true, false])('a place_topic chip sends its text and includes both identifiers only with an id (%s)', async hasId => {
  const selected: AssistantFollowUpGroup = {
    ...group('place_topic', hasId ? 'topic_address_2' : null),
    options: [{ ...(hasId ? { id: 'topic_address_2' } : {}), label: 'Địa chỉ', text: 'Địa chỉ của quán thứ 2 ở đâu?' }],
  }
  const { view, backend } = await openReply([selected])
  await act(async () => { await fireEvent.press(view.getByRole('button', { name: 'Thông tin khác Địa chỉ' })) })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(1))
  expect(callsTo(backend, 'sendMessage')[0]![1]).toEqual({
    text: selected.options[0]!.text,
    locale: 'vi',
    ...(hasId ? { replyToMessageId: REPLY_ID, followUpOptionId: 'topic_address_2' } : {}),
  })
  await settle()
})

it.each([false, true])('typed text matching a chip sends neither identifier, including after a failed chip (%s)', async failedChip => {
  const { view, backend } = await openReply([group()])
  if (failedChip) {
    jest.spyOn(backend, 'sendMessage').mockImplementationOnce((...args) => {
      backend.calls.push({ name: 'sendMessage', args })
      return Promise.reject(new NetworkError('offline'))
    })
    await act(async () => { await fireEvent.press(view.getByRole('button', { name: 'Chọn địa điểm This café' })) })
    await view.findByTestId('assistant-user-retry')
  }
  await act(async () => { await fireEvent.changeText(view.getByLabelText(i18n.t('assistant.composer.label')), group().options[0]!.text) })
  await act(async () => { await fireEvent.press(view.getByRole('button', { name: i18n.t('assistant.composer.send') })) })
  const index = failedChip ? 1 : 0
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(index + 1))
  expect(callsTo(backend, 'sendMessage')[index]![1]).toEqual({ text: group().options[0]!.text, locale: 'vi' })
  if (failedChip) expect(callsTo(backend, 'sendMessage')[1]![2]).not.toBe(callsTo(backend, 'sendMessage')[0]![2])
  await settle()
})

it('retry preserves the chip identifiers, body and idempotency key', async () => {
  const { view, backend } = await openReply([group()])
  const send = backend.sendMessage
  jest.spyOn(backend, 'sendMessage').mockImplementationOnce((...args) => {
    // Record a transport failure after the request may have reached the server.
    backend.calls.push({ name: 'sendMessage', args })
    return Promise.reject(new NetworkError('offline'))
  }).mockImplementation(send)
  await act(async () => { await fireEvent.press(view.getByRole('button', { name: 'Chọn địa điểm This café' })) })
  await waitFor(() => expect(view.getByTestId('assistant-user-retry')).toBeTruthy())
  await act(async () => { await fireEvent.press(view.getByTestId('assistant-user-retry')) })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(2))
  expect(callsTo(backend, 'sendMessage')[1]).toEqual(callsTo(backend, 'sendMessage')[0])
  expect(callsTo(backend, 'sendMessage')[1]![1]).toMatchObject({ replyToMessageId: REPLY_ID, followUpOptionId: 'pick_1' })
  await settle()
})

it('renders supplied verified facts through the shared small PlaceCard and opens the place', async () => {
  const { view } = await openReply([], [{ ...card, facts: { ...card.facts,
    addressText: '12 Nguyễn Huệ', photoUrl: 'https://example.com/verified.jpg',
    providerRating: 4.6, providerRatingCount: 980, providerRatingSource: 'google',
    gogoRating: 4.2, gogoRatingCount: 25 } }])
  const result = within(view.getByTestId('assistant-card-place-652'))
  expect(result.getByTestId('place-card-small')).toBeTruthy()
  expect(result.getByTestId('place-card-name')).toHaveTextContent(card.facts.name)
  expect(result.getByTestId('place-card-address-row')).toHaveTextContent('12 Nguyễn Huệ')
  expect(result.getByTestId('place-photo-image').props.source[0].uri).toBe('https://example.com/verified.jpg')
  expect(result.getByTestId('place-photo-image').props.cachePolicy).toBe('memory-disk')
  expect(result.getByTestId('place-google-rating')).toHaveTextContent('★ 4,6 (980) Google')
  expect(result.getByTestId('place-gogo-rating')).toHaveTextContent(/4,2.*25/)
  await act(async () => { await fireEvent.press(result.getByRole('button', { name: card.facts.name })) })
  expect(mockRouter.push).toHaveBeenCalledWith('/places/place-652')
})

it('keeps the shared small card with name only and omits absent image, address, ratings and price', async () => {
  const { view } = await openReply([], [card])
  const result = within(view.getByTestId('assistant-card-place-652'))
  expect(result.getByTestId('place-card-small')).toBeTruthy()
  expect(result.getByText(card.facts.name)).toBeTruthy()
  for (const id of ['place-photo-image', 'place-card-address-row', 'place-card-ratings', 'place-google-rating', 'place-gogo-rating', 'place-card-price']) {
    expect(result.queryByTestId(id)).toBeNull()
  }
})

it('renders both places in a comparison as separate shared small PlaceCards in response order', async () => {
  const compared: AssistantPlaceCard[] = [
    { ...card, placeId: 'place-z', facts: { name: 'First comparison café' } },
    { ...card, placeId: 'place-a', facts: { name: 'Second comparison café' } },
  ]
  const { view } = await openReply([], compared)
  const results = view.getAllByTestId(/^assistant-card-place-/)
  expect(results.map(result => result.props.testID)).toEqual(['assistant-card-place-z', 'assistant-card-place-a'])
  expect(view.getAllByTestId('place-card-small')).toHaveLength(2)
  results.forEach((result, index) => {
    const smallCards = within(result).getAllByTestId('place-card-small')
    expect(smallCards).toHaveLength(1)
    expect(within(smallCards[0]!).getByTestId('place-card-name')).toHaveTextContent(compared[index]!.facts.name)
  })
})
