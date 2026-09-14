import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * PROF-APP-006 (#217) — the optional date of birth in account information:
 * a calendar date shown without a time-zone shift, the server's two rules
 * checked before a request, clearing, a failed save rolled back, and a
 * different sign-in that never sees the previous account's value.
 *
 * The real `useUpdateDateOfBirth` and `useMe` run against a real QueryClient;
 * only the HTTP endpoints are faked, so the optimistic write and its rollback
 * are what is under test. Every binding a jest.mock factory touches must be
 * `mock`-prefixed; the factories are hoisted above the imports.
 */

const mockUpdateProfile = jest.fn()
const mockGetMe = jest.fn()

jest.mock('@/shared/api/endpoints/sessions', () => ({
  ...jest.requireActual('@/shared/api/endpoints/sessions'),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  getMe: (...args: unknown[]) => mockGetMe(...args),
}))

import { todayInVietnam } from '@/features/account/date-of-birth'
import { DateOfBirthCard } from '@/features/account/date-of-birth.view'
import { ApiError, queryKeys, useMe, type Me } from '@/shared/api'

const INPUT = 'Ngày sinh (ngày/tháng/năm)'
const SAVE = 'Lưu ngày sinh'
const CLEAR = 'Xoá ngày sinh'

function profile(overrides: Partial<Me> = {}): Me {
  return {
    actorType: 'user',
    id: 'user-a',
    displayName: 'An',
    locale: 'vi',
    avatarUrl: null,
    homeArea: null,
    interests: { mood: [] },
    usualBudget: null,
    capabilities: { avatarUpload: 'available' },
    ...overrides,
  } as Me
}

/** Mirrors the account screen: the card is keyed by the signed-in account. */
function Screen() {
  const me = useMe()
  return me.data ? <DateOfBirthCard key={me.data.id} profile={me.data} /> : null
}

let queryClient: QueryClient
const server: { profile: Me | null } = { profile: null }

async function mount(initial: Me) {
  server.profile = initial
  queryClient.setQueryData(queryKeys.me(), initial)
  return renderScreen(
    <QueryClientProvider client={queryClient}>
      <Screen />
    </QueryClientProvider>,
  )
}

type View = Awaited<ReturnType<typeof mount>>

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element)
  })
}

async function typeDate(view: View, text: string) {
  await act(async () => {
    fireEvent.changeText(view.getByLabelText(INPUT), text)
  })
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  mockUpdateProfile.mockReset()
  mockGetMe.mockReset()
  mockGetMe.mockImplementation(async () => server.profile)
  // A server that applies the patch and answers the whole profile.
  mockUpdateProfile.mockImplementation(async (body: Partial<Me>) => {
    server.profile = { ...server.profile!, ...body }
    return server.profile
  })
})

afterEach(() => {
  queryClient.clear()
})

describe('date of birth in account information', () => {
  it('an old account whose profile has no such field reads as unset, with nothing to clear', async () => {
    const legacy = profile()
    expect('dateOfBirth' in legacy).toBe(false)
    const view = await mount(legacy)
    expect(view.getByText('Chưa đặt ngày sinh')).toBeTruthy()
    expect(view.getByLabelText(INPUT).props.value).toBe('')
    expect(view.queryByText(CLEAR)).toBeNull()
  })

  it('shows a saved date in the reader’s language, on the same calendar day', async () => {
    const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
    expect(view.getByText('Đã lưu: 17 tháng 5, 1990')).toBeTruthy()
    expect(view.getByLabelText(INPUT).props.value).toBe('17/05/1990')
  })

  it('saves a real leap day as YYYY-MM-DD', async () => {
    const view = await mount(profile())
    await typeDate(view, '29/02/2024')
    await press(view.getByText(SAVE))
    expect(await view.findByText('✓ Đã lưu ngày sinh')).toBeTruthy()
    expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: '2024-02-29' })
    expect(view.getByText('Đã lưu: 29 tháng 2, 2024')).toBeTruthy()
  })

  it('refuses a leap day that does not exist and a date after today in Hanoi, without a request', async () => {
    const view = await mount(profile())
    await typeDate(view, '29/02/2027')
    await press(view.getByText(SAVE))
    expect(await view.findByText('Ngày không hợp lệ. Nhập một ngày có thật theo dạng ngày/tháng/năm.')).toBeTruthy()

    const [year, month, day] = todayInVietnam().split('-').map(Number) as [number, number, number]
    const tomorrow = new Date(0)
    tomorrow.setUTCFullYear(year, month - 1, day + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    await typeDate(view, `${pad(tomorrow.getUTCDate())}/${pad(tomorrow.getUTCMonth() + 1)}/${tomorrow.getUTCFullYear()}`)
    await press(view.getByText(SAVE))
    expect(await view.findByText('Ngày sinh không thể sau hôm nay.')).toBeTruthy()
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('names the rule when the server refuses the date itself', async () => {
    const fieldErrors = [{ field: 'dateOfBirth', code: 'too_big', message: 'cannot be after today' }]
    mockUpdateProfile.mockRejectedValue(
      new ApiError(400, { code: 'VALIDATION_FAILED', message: 'Request validation failed', field_errors: fieldErrors }),
    )
    const view = await mount(profile())
    await typeDate(view, '01/01/2000')
    await press(view.getByText(SAVE))
    expect(await view.findByText('Ngày sinh không thể sau hôm nay.')).toBeTruthy()
    expect(view.getByText('Chưa đặt ngày sinh')).toBeTruthy()
  })

  it('clearing sends null and reads as unset', async () => {
    const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
    await press(view.getByText(CLEAR))
    expect(await view.findByText('✓ Đã xoá ngày sinh')).toBeTruthy()
    expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: null })
    expect(view.getByText('Chưa đặt ngày sinh')).toBeTruthy()
    expect(view.getByLabelText(INPUT).props.value).toBe('')
  })

  it('a failed save shows the new date while pending, then puts the saved one back and keeps the typing', async () => {
    let reject: (error: unknown) => void = () => {}
    mockUpdateProfile.mockImplementation(
      () =>
        new Promise((_resolve, rejectRequest) => {
          reject = rejectRequest
        }),
    )
    const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
    await typeDate(view, '01/01/2000')
    await press(view.getByText(SAVE))
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: '2000-01-01' }))
    expect(view.getByText('Đã lưu: 1 tháng 1, 2000')).toBeTruthy()

    await act(async () => {
      reject(new Error('boom'))
    })
    expect(await view.findByText('Chưa lưu được ngày sinh. Thử lại nhé.')).toBeTruthy()
    expect(view.getByText('Đã lưu: 17 tháng 5, 1990')).toBeTruthy()
    expect(queryClient.getQueryData<Me>(queryKeys.me())?.dateOfBirth).toBe('1990-05-17')
    expect(view.getByLabelText(INPUT).props.value).toBe('01/01/2000')
  })

  it('a fast double press on save or clear sends one request', async () => {
    let answer: (profile: Me) => void = () => {}
    mockUpdateProfile.mockImplementation(
      (body: Partial<Me>) =>
        new Promise<Me>(resolve => {
          answer = next => {
            server.profile = { ...server.profile!, ...body, ...next }
            resolve(server.profile)
          }
        }),
    )
    const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
    await typeDate(view, '01/01/2000')
    const save = view.getByText(SAVE)
    // Both presses land before React re-renders the disabled button.
    await act(async () => {
      fireEvent.press(save)
      fireEvent.press(save)
    })
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled())
    await act(async () => {
      answer({ ...server.profile!, dateOfBirth: '2000-01-01' })
    })
    expect(await view.findByText('Đã lưu: 1 tháng 1, 2000')).toBeTruthy()
    expect(mockUpdateProfile).toHaveBeenCalledTimes(1)

    const clear = view.getByText(CLEAR)
    await act(async () => {
      fireEvent.press(clear)
      fireEvent.press(clear)
    })
    await act(async () => {
      answer({ ...server.profile!, dateOfBirth: null })
    })
    expect(mockUpdateProfile).toHaveBeenCalledTimes(2)
    expect(mockUpdateProfile).toHaveBeenLastCalledWith({ dateOfBirth: null })
  })

  it('after signing in as someone else, shows that account’s date and never the previous one’s late answer', async () => {
    let answer: (profile: Me) => void = () => {}
    mockUpdateProfile.mockImplementation(
      () =>
        new Promise<Me>(resolve => {
          answer = resolve
        }),
    )
    const accountA = profile({ id: 'user-a', dateOfBirth: '1990-05-17' })
    const accountB = profile({ id: 'user-b', displayName: 'Bình', dateOfBirth: '1985-11-03' })
    const view = await mount(accountA)
    await typeDate(view, '02/02/2002')
    await press(view.getByText(SAVE))
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled())

    // Account B signs in. Its refetch never lands in this test, so whatever
    // the cache holds afterwards is what A's late answer wrote, or did not.
    mockGetMe.mockImplementation(() => new Promise(() => {}))
    await act(async () => {
      queryClient.setQueryData(queryKeys.me(), accountB)
    })
    expect(await view.findByText('Đã lưu: 3 tháng 11, 1985')).toBeTruthy()
    expect(view.getByLabelText(INPUT).props.value).toBe('03/11/1985')

    await act(async () => {
      answer({ ...accountA, dateOfBirth: '2002-02-02' })
    })
    expect(queryClient.getQueryData<Me>(queryKeys.me())).toMatchObject({ id: 'user-b', dateOfBirth: '1985-11-03' })
    expect(view.getByText('Đã lưu: 3 tháng 11, 1985')).toBeTruthy()
    expect(view.queryByText('Đã lưu: 2 tháng 2, 2002')).toBeNull()
  })
})
