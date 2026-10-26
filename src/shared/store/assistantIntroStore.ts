import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * How far one account has got with GoGo AI on this device (GoGo-MobileApp#379):
 * the Home coachmark (once per account, after the first created plan or the
 * third Home visit, never on the launch the account was first seen), the "New"
 * badge on the float button (until the first open) and the "Chat saved in GoGo
 * AI history" toast (the first close of a real chat).
 *
 * UI flags, not server state and not a credential — AsyncStorage, the same
 * store `recentRoomsStore` and the onboarding flag use. Keyed by the account,
 * so the next person on the device starts fresh. Kept across sign-out on
 * purpose: purging it would introduce the assistant again on every sign-in,
 * which is the "once per account" the issue rules out. It holds counts and
 * booleans only, nothing from a room, and `forgetAssistantIntro` drops an
 * account's entry when the account is deleted.
 */
export interface AssistantIntro {
  homeVisits: number
  planCreated: boolean
  /** The coachmark was answered — "Try it" or "Not now". Either is final. */
  introduced: boolean
  /** GoGo AI was opened at least once — the "New" badge is gone. */
  opened: boolean
  chatSavedToastShown: boolean
  /** The app launch this account was first seen on: no coachmark during it. */
  firstLaunch: string
}

/** One value per JavaScript runtime, i.e. per app launch. */
export const CURRENT_LAUNCH = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** The coachmark waits for the third visit to Home. */
export const HOME_VISITS_BEFORE_INTRO = 3

function fresh(): AssistantIntro {
  return {
    homeVisits: 0,
    planCreated: false,
    introduced: false,
    opened: false,
    chatSavedToastShown: false,
    firstLaunch: CURRENT_LAUNCH,
  }
}

interface AssistantIntroState {
  accounts: Record<string, AssistantIntro>
  update: (account: string, change: (intro: AssistantIntro) => Partial<AssistantIntro>) => void
  forget: (account: string) => void
}

export const useAssistantIntroStore = create<AssistantIntroState>()(
  persist(
    set => ({
      accounts: {},
      update: (account, change) =>
        set(state => {
          const current = state.accounts[account] ?? fresh()
          return { accounts: { ...state.accounts, [account]: { ...current, ...change(current) } } }
        }),
      forget: account =>
        set(state => {
          const { [account]: _gone, ...rest } = state.accounts
          return { accounts: rest }
        }),
    }),
    {
      name: 'gogo.assistant-intro.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ accounts: state.accounts }),
    },
  ),
)

const update = (account: string, change: (intro: AssistantIntro) => Partial<AssistantIntro>) =>
  useAssistantIntroStore.getState().update(account, change)

export function noteAssistantHomeVisit(account: string): void {
  update(account, intro => ({ homeVisits: intro.homeVisits + 1 }))
}

export function noteAssistantPlanCreated(account: string): void {
  update(account, () => ({ planCreated: true }))
}

export function markAssistantIntroduced(account: string): void {
  update(account, () => ({ introduced: true }))
}

export function markAssistantOpened(account: string): void {
  update(account, () => ({ opened: true }))
}

/** The account is gone; so is what this device knew about it. */
export function forgetAssistantIntro(account: string): void {
  useAssistantIntroStore.getState().forget(account)
}

/**
 * Whether the Home coachmark is due. Not on the launch the account was first
 * seen; then after a created plan or the third Home visit, until answered. An
 * account that already opened GoGo AI needs no introduction.
 */
export function assistantCoachmarkDue(intro: AssistantIntro | undefined, launch: string = CURRENT_LAUNCH): boolean {
  if (!intro || intro.introduced || intro.opened) return false
  if (intro.firstLaunch === launch) return false
  return intro.planCreated || intro.homeVisits >= HOME_VISITS_BEFORE_INTRO
}

/** "New" on the float button until this account first opens GoGo AI. */
export function assistantIsNew(intro: AssistantIntro | undefined): boolean {
  return !intro?.opened
}

/**
 * Closing GoGo AI: whether to show "Chat saved in GoGo AI history". Only when
 * a chat exists to be saved, and only the first time for this account — the
 * flag is spent only when the toast is shown. The assistant shell has no chat
 * yet (#378 waits on GoGo-BE#713), so it always passes `hasChat: false`.
 */
export function takeChatSavedToast(account: string | null, hasChat: boolean): boolean {
  if (!account || !hasChat) return false
  const intro = useAssistantIntroStore.getState().accounts[account]
  if (intro?.chatSavedToastShown) return false
  update(account, () => ({ chatSavedToastShown: true }))
  return true
}
