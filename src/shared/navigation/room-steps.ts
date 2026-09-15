import { useEffect } from 'react'

/**
 * GoGo-MobileApp#198 — what this app session has already shown for a room: the
 * decision screen for a suggestion run, or a plan.
 *
 * The lobby sends everyone on once the room moves (a run lands, a plan is
 * finalized). It must do that once per change, never again: the screens it
 * sends people to all lead back to the lobby — "Về phòng chờ", a superseded
 * plan's notice, plain Back — and a lobby that re-sent them would bounce them
 * forever. So the destination records itself when it renders, and the lobby
 * only moves someone to a step no screen has shown yet.
 *
 * Session memory only: ids, no content, gone on restart — where a room that is
 * still deciding should open on its decision screen again.
 */
const shown = new Map<string, Set<string>>()

/**
 * The inbox opened the room because the plan a notification was about could
 * not be opened; the lobby says so instead of looking like a wrong turn.
 */
export const PLAN_UNAVAILABLE_NOTICE = 'plan_unavailable'

export const runStep = (runId: string) => `run:${runId}`
export const planStep = (planId: string) => `plan:${planId}`

export function markRoomStepShown(roomId: string, step: string): void {
  const steps = shown.get(roomId) ?? new Set<string>()
  steps.add(step)
  shown.set(roomId, steps)
}

export function wasRoomStepShown(roomId: string, step: string): boolean {
  return shown.get(roomId)?.has(step) ?? false
}

/** A destination screen records the step it is showing. */
export function useRoomStepShown(roomId: string | undefined, step: string | null): void {
  useEffect(() => {
    if (roomId && step) markRoomStepShown(roomId, step)
  }, [roomId, step])
}

/** Test seam: forget every room's steps. */
export function resetRoomStepsForTests(): void {
  shown.clear()
}
