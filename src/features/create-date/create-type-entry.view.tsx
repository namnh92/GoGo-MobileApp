import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useEffect } from 'react'
import type { NavigationProp } from '@react-navigation/native'

import { useRoomStore } from '@/shared/store/roomStore'
import { draftStepPath, draftStepSchema, type DraftStep } from '@/shared/store/savedRoomDraft'

import CreateTypeScreen from './create-type.view'

/** Runs inside the mounted create Stack, so reset never targets the root. */
export default function CreateTypeEntry() {
  const { resumeStep } = useLocalSearchParams<{ resumeStep?: string }>()
  const navigation = useNavigation<NavigationProp<Record<DraftStep, undefined>>>()
  const parsed = draftStepSchema.safeParse(resumeStep)
  const step = parsed.success ? parsed.data : null
  useEffect(() => {
    if (!step) return
    const routes = draftStepPath(step, useRoomStore.getState().audience).map(name => ({ name }))
    // Reset also consumes resumeStep: Back to type must never restore again.
    navigation.reset({ index: routes.length - 1, routes })
  }, [navigation, step])

  // Do not mount the first-step form/location effects during later-step restore.
  return step ? null : <CreateTypeScreen />
}
