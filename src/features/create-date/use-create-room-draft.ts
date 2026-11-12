import { useQueryClient } from '@tanstack/react-query'
import { prepareRoomInvite } from '@/features/gogo-room/prepare-room-invite'
import { useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { isApiError, useCreateRoom } from '@/shared/api'
import { newIdempotencyKey } from '@/shared/api/idempotency'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { clearSavedRoomDraft, saveRoomDraft } from '@/shared/store/savedRoomDraft'
import { noteAssistantPlanCreated } from '@/shared/store/assistantIntroStore'
import { toCreateRoomBody, useRoomStore } from '@/shared/store/roomStore'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { budgetAmountSchema } from './budget-picker'

/** One create transaction for wizard presenters, including persisted retry identity. */
export function useCreateRoomDraft() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { status, session } = useSession()
  const rememberRoom = useRecentRoomsStore(state => state.remember)
  const createRoom = useCreateRoom({ idempotencyKey: () => useRoomStore.getState().creationAttempt!.key })
  const pending = useRoomStore(state => state.creationPending)
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    // Only an account can own a room — a guest session gets 403 USER_ONLY.
    if (status !== 'user') {
      router.push('/auth/sign-in?next=create')
      return
    }

    const budget = budgetAmountSchema.safeParse(useRoomStore.getState().budgetAmount)
    if (!budget.success) {
      const key = budget.error.issues[0]!.message
      setError(t(key === 'budgetPicker.required' ? 'budgetPicker.required'
        : key === 'budgetPicker.format' ? 'budgetPicker.format'
        : key === 'budgetPicker.integer' ? 'budgetPicker.integer' : 'budgetPicker.bounds'))
      return
    }

    if (submitting.current) return
    submitting.current = true
    useRoomStore.setState({ creationPending: true })
    setError(null)
    try {
      const body = toCreateRoomBody(useRoomStore.getState())
      const fingerprint = JSON.stringify(body)
      const attempt = useRoomStore.getState().creationAttempt
      if (attempt?.fingerprint !== fingerprint) {
        useRoomStore.setState({ creationAttempt: { key: newIdempotencyKey(), fingerprint } })
      }
      // Persist the request identity before sending, so a timeout or restart
      // retries the same room creation instead of publishing a second room.
      if (session?.userId) await saveRoomDraft(session.userId, 'places')
      const room = await createRoom.mutateAsync(body)
      rememberRoom(room)
      void prepareRoomInvite(queryClient, room.id).catch(() => undefined)
      // A created plan makes the GoGo AI introduction due on Home (#379).
      if (session?.userId) noteAssistantPlanCreated(session.userId)
      // Every member chooses preferences on the preference screen.
      useRoomStore.getState().finishDraft()
      await clearSavedRoomDraft().catch(() => undefined)
      track('gogo_room_created', { roomType: room.type, decisionMode: room.decisionMode })
      router.replace(`/room/${room.id}`)
    } catch (caught) {
      setError(
        // ADM-020: the area was chosen from a dataset that has since been
        // replaced — say so, instead of a generic failure the retry cannot fix.
        isApiError(caught) && caught.code === 'ADMINISTRATIVE_VERSION_CHANGED'
          ? t('administrative.changed')
          : isApiError(caught) && caught.fieldErrors.length > 0
            ? caught.fieldErrors[0].message
            : t('createPlaces.createFailed'),
      )
    } finally { submitting.current = false; useRoomStore.setState({ creationPending: false }) }
  }

  return { submit, error, pending: pending || createRoom.isPending }
}
