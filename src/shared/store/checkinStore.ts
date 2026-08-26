import { create } from 'zustand'

// Per-stop check-ins during the active date. Client/flow state (mock) —
// the real app syncs these through the plan/review API and purges on logout.
export interface StopCheckin {
  rating: number
  tags: string[]
  note: string
  /** Local photo URIs picked from the library/camera. */
  photos: string[]
  at: string
}

interface CheckinStoreState {
  checkins: Record<string, StopCheckin>
  saveCheckin: (stopTime: string, checkin: StopCheckin) => void
  clearCheckins: () => void
}

export const useCheckinStore = create<CheckinStoreState>()(set => ({
  checkins: {},
  saveCheckin: (stopTime, checkin) =>
    set(state => ({ checkins: { ...state.checkins, [stopTime]: checkin } })),
  clearCheckins: () => set({ checkins: {} }),
}))
