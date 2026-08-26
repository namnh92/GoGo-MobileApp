import { create } from 'zustand'

import type { SavedPlace } from '@/data/types'

// Demo/client state only (drafts, flow state, permissions) — Zustand per the
// state-ownership rule. Server state stays in TanStack Query. Model ported
// from the mockup RoomContext (spec v3 §22 / v4 §35).
export type DemoAudience = 'couple' | 'group-host' | 'group-guest'
export type DemoUIState = 'default' | 'loading' | 'empty' | 'error'
export type RoomType = 'couple' | 'group'
export type BudgetMode = 'per_person' | 'total'
/** Home quick presets (spec §8.3) — a draft context filter, not a create action. */
export type QuickPreset = 'tonight' | 'weekend' | 'special'

interface RoomStoreState {
  audience: DemoAudience
  uiState: DemoUIState
  participantCount: number
  budgetMode: BudgetMode
  quickPreset: QuickPreset
  /** Khu vực xuất phát của room draft. */
  area: string
  /** Giờ bắt đầu (bắt buộc trước khi qua bước sau) và kết thúc dự kiến. */
  startTime: string | null
  endTime: string | null
  /** Host-suggested places attached to the room draft (create flow). */
  seedPlaces: SavedPlace[]
  /** Locked itinerary stops (by stop time) — shared between plan and regenerate. */
  lockedStops: string[]
  setAudience: (a: DemoAudience) => void
  setUiState: (s: DemoUIState) => void
  setParticipantCount: (n: number) => void
  setBudgetMode: (mode: BudgetMode) => void
  setQuickPreset: (p: QuickPreset) => void
  setArea: (area: string) => void
  setStartTime: (t: string | null) => void
  setEndTime: (t: string | null) => void
  addSeedPlace: (place: SavedPlace) => void
  removeSeedPlace: (title: string) => void
  toggleLockedStop: (time: string) => void
}

export const useRoomStore = create<RoomStoreState>()(set => ({
  audience: 'couple',
  uiState: 'default',
  participantCount: 4,
  budgetMode: 'per_person',
  quickPreset: 'tonight',
  area: 'Thảo Điền, TP.HCM',
  startTime: null,
  endTime: null,
  seedPlaces: [],
  lockedStops: [],
  setAudience: audience => set({ audience }),
  setUiState: uiState => set({ uiState }),
  setParticipantCount: participantCount => set({ participantCount }),
  setBudgetMode: budgetMode => set({ budgetMode }),
  setQuickPreset: quickPreset => set({ quickPreset }),
  setArea: area => set({ area }),
  setStartTime: startTime => set({ startTime }),
  setEndTime: endTime => set({ endTime }),
  addSeedPlace: place =>
    set(state =>
      state.seedPlaces.some(p => p.title === place.title)
        ? state
        : { seedPlaces: [...state.seedPlaces, place] },
    ),
  removeSeedPlace: title =>
    set(state => ({ seedPlaces: state.seedPlaces.filter(p => p.title !== title) })),
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
  quickPreset: QuickPreset
  area: string
  startTime: string | null
  endTime: string | null
  seedPlaces: SavedPlace[]
  lockedStops: string[]
  setAudience: (a: DemoAudience) => void
  setUiState: (s: DemoUIState) => void
  setParticipantCount: (n: number) => void
  setBudgetMode: (mode: BudgetMode) => void
  setQuickPreset: (p: QuickPreset) => void
  setArea: (area: string) => void
  setStartTime: (t: string | null) => void
  setEndTime: (t: string | null) => void
  addSeedPlace: (place: SavedPlace) => void
  removeSeedPlace: (title: string) => void
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
