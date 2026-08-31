import { create } from 'zustand'

import type { DecisionMode, OpBody } from '@/shared/api'

/** A host-suggested place on the room draft: the id is what the API needs. */
export interface SeedPlaceRef {
  placeId: string
  name: string
}

/** `POST /rooms` accepts at most ten seed places. */
export const MAX_SEED_PLACES = 10

// Demo/client state only (drafts, flow state, permissions) — Zustand per the
// state-ownership rule. Server state stays in TanStack Query. Model ported
// from the mockup RoomContext (spec v3 §22 / v4 §35).
export type DemoAudience = 'couple' | 'group-host' | 'group-guest'
export type DemoUIState = 'default' | 'loading' | 'empty' | 'error'
export type RoomType = 'couple' | 'group'
export type BudgetMode = 'per_person' | 'total'
/** Home quick presets (spec §8.3) — a draft context filter, not a create action. */
export type QuickPreset = 'tonight' | 'weekend' | 'special'

/**
 * The wizard collects everything `POST /rooms` needs before the room exists, so
 * these fields are a genuine client draft rather than duplicated server state.
 * Once the room is created the draft is reset and `useRoom(roomId)` owns the
 * facts.
 */
export interface RoomDraft {
  decisionMode: DecisionMode
  /** Budget in integer minor units (RULE-CORE-004); null until the user picks. */
  budgetAmount: number | null
  currency: string
  /** Stable area key from the Places proxy — never the display label. */
  areaKey: string | null
  originLat: number | null
  originLng: number | null
  radiusM: number | null
  /** ISO-8601 UTC, built from the picked local times. */
  startAt: string | null
  endAt: string | null
  /** Stable taxonomy keys, carried into the first preference save. */
  moodKeys: string[]
  settingKeys: string[]
  spendingStyleKey: string | null
}

interface RoomStoreState extends RoomDraft {
  audience: DemoAudience
  uiState: DemoUIState
  participantCount: number
  budgetMode: BudgetMode
  quickPreset: QuickPreset
  /** Khu vực xuất phát của room draft — display label only. */
  area: string
  /** Giờ bắt đầu (bắt buộc trước khi qua bước sau) và kết thúc dự kiến. */
  startTime: string | null
  endTime: string | null
  /**
   * Host-suggested places attached to the room draft. Holds real place ids —
   * the name is carried only so the chip can be labelled without a fetch.
   */
  seedPlaces: SeedPlaceRef[]
  setAudience: (a: DemoAudience) => void
  setUiState: (s: DemoUIState) => void
  setParticipantCount: (n: number) => void
  setBudgetMode: (mode: BudgetMode) => void
  setQuickPreset: (p: QuickPreset) => void
  setArea: (area: string) => void
  setStartTime: (t: string | null) => void
  setEndTime: (t: string | null) => void
  addSeedPlace: (place: SeedPlaceRef) => void
  removeSeedPlace: (placeId: string) => void
  patchDraft: (patch: Partial<RoomDraft>) => void
  resetDraft: () => void
}

const emptyDraft: RoomDraft = {
  decisionMode: 'match',
  budgetAmount: null,
  currency: 'VND',
  areaKey: null,
  originLat: null,
  originLng: null,
  radiusM: null,
  startAt: null,
  endAt: null,
  moodKeys: [],
  settingKeys: [],
  spendingStyleKey: null,
}

export const useRoomStore = create<RoomStoreState>()(set => ({
  ...emptyDraft,
  audience: 'couple',
  uiState: 'default',
  participantCount: 4,
  budgetMode: 'per_person',
  quickPreset: 'tonight',
  area: 'Thảo Điền, TP.HCM',
  startTime: null,
  endTime: null,
  seedPlaces: [],
  patchDraft: patch => set(patch),
  resetDraft: () => set({ ...emptyDraft, seedPlaces: [] }),
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
      // The contract caps seed places at 10; adding an eleventh silently would
      // drop it at create time instead of here.
      state.seedPlaces.some(candidate => candidate.placeId === place.placeId) ||
      state.seedPlaces.length >= MAX_SEED_PLACES
        ? state
        : { seedPlaces: [...state.seedPlaces, place] },
    ),
  removeSeedPlace: placeId =>
    set(state => ({ seedPlaces: state.seedPlaces.filter(place => place.placeId !== placeId) })),
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
  seedPlaces: SeedPlaceRef[]
  setAudience: (a: DemoAudience) => void
  setUiState: (s: DemoUIState) => void
  setParticipantCount: (n: number) => void
  setBudgetMode: (mode: BudgetMode) => void
  setQuickPreset: (p: QuickPreset) => void
  setArea: (area: string) => void
  setStartTime: (t: string | null) => void
  setEndTime: (t: string | null) => void
  addSeedPlace: (place: SeedPlaceRef) => void
  removeSeedPlace: (placeId: string) => void
  roomType: RoomType
  isGuest: boolean
  /** UI authorization (spec v4 §35): guests never see host-only controls. */
  canRegenerate: boolean
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
    canEditConstraints: !isGuest,
  }
}

/** Everything the wizard still has to collect before the room can be created. */
export function missingDraftFields(state: RoomStoreState): string[] {
  const missing: string[] = []
  if (state.budgetAmount == null) missing.push('budget')
  if (!state.areaKey && state.originLat == null) missing.push('area')
  return missing
}

/**
 * The single place that turns the wizard draft into the create-room contract.
 * A couple room decides by mutual match, a group by vote — the host can change
 * it later, but the default follows the room type rather than the route.
 */
export function toCreateRoomBody(state: RoomStoreState): OpBody<'createRoom'> {
  const roomType = state.audience === 'couple' ? 'couple' : 'group'
  return {
    type: roomType,
    decisionMode: roomType === 'couple' ? 'match' : 'vote',
    participantCount: roomType === 'couple' ? 2 : state.participantCount,
    constraint: {
      budgetMode: state.budgetMode,
      budgetAmount: state.budgetAmount ?? 0,
      currency: state.currency,
      ...(state.areaKey ? { areaKey: state.areaKey } : {}),
      ...(state.originLat != null && state.originLng != null
        ? { originLat: state.originLat, originLng: state.originLng }
        : {}),
      ...(state.radiusM != null ? { radiusM: state.radiusM } : {}),
      ...(state.startAt ? { startAt: state.startAt } : {}),
      ...(state.endAt ? { endAt: state.endAt } : {}),
    },
    ...(state.seedPlaces.length > 0
      ? { seedPlaceIds: state.seedPlaces.slice(0, MAX_SEED_PLACES).map(place => place.placeId) }
      : {}),
  }
}
