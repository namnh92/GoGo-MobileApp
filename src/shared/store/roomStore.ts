import { create } from 'zustand'

// Demo/client state only (drafts, flow state, permissions) — Zustand per the
// state-ownership rule. Server state stays in TanStack Query. Model ported
// from the mockup RoomContext (spec v3 §22 / v4 §35).
export type DemoAudience = 'couple' | 'group-host' | 'group-guest'
export type DemoUIState = 'default' | 'loading' | 'empty' | 'error'
export type RoomType = 'couple' | 'group'
export type BudgetMode = 'per_person' | 'total'

interface RoomStoreState {
  audience: DemoAudience
  uiState: DemoUIState
  participantCount: number
  budgetMode: BudgetMode
  /** Locked itinerary stops (by stop time) — shared between plan and regenerate. */
  lockedStops: string[]
  setAudience: (a: DemoAudience) => void
  setUiState: (s: DemoUIState) => void
  setParticipantCount: (n: number) => void
  setBudgetMode: (mode: BudgetMode) => void
  toggleLockedStop: (time: string) => void
}

export const useRoomStore = create<RoomStoreState>()(set => ({
  audience: 'couple',
  uiState: 'default',
  participantCount: 4,
  budgetMode: 'per_person',
  lockedStops: [],
  setAudience: audience => set({ audience }),
  setUiState: uiState => set({ uiState }),
  setParticipantCount: participantCount => set({ participantCount }),
  setBudgetMode: budgetMode => set({ budgetMode }),
  toggleLockedStop: time =>
    set(state => ({
      lockedStops: state.lockedStops.includes(time)
        ? state.lockedStops.filter(x => x !== time)
        : [...state.lockedStops, time],
    })),
}))

export interface RoomView {
  audience: DemoAudience
  uiState: DemoUIState
  participantCount: number
  budgetMode: BudgetMode
  lockedStops: string[]
  setAudience: (a: DemoAudience) => void
  setUiState: (s: DemoUIState) => void
  setParticipantCount: (n: number) => void
  setBudgetMode: (mode: BudgetMode) => void
  toggleLockedStop: (time: string) => void
  roomType: RoomType
  isGuest: boolean
  /** UI authorization (spec v4 §35): guests never see host-only controls. */
  canRegenerate: boolean
  canLockStops: boolean
  canEditConstraints: boolean
}

export function useRoom(): RoomView {
  const state = useRoomStore()
  const isGuest = state.audience === 'group-guest'
  return {
    ...state,
    roomType: state.audience === 'couple' ? 'couple' : 'group',
    isGuest,
    canRegenerate: !isGuest,
    canLockStops: !isGuest,
    canEditConstraints: !isGuest,
  }
}
