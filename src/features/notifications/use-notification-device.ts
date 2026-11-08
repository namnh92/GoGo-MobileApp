import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { AppState, Linking } from 'react-native'
import { pushPermission } from '@/shared/notifications/permission-bootstrap'

export type PushState = 'checking' | 'granted' | 'askable' | 'unknown'

/** Device permission stays separate from the account's notification choices. */
export function useNotificationDevice() {
  const [pushState, setPushState] = useState<PushState>('checking')
  const [settingsError, setSettingsError] = useState(false)
  const permissionRevision = useRef(0)
  const refreshPushState = useCallback(() => {
    const currentRevision = ++permissionRevision.current
    void pushPermission.status().then(next => {
      if (currentRevision !== permissionRevision.current) return
      if (next !== 'askable') setSettingsError(false)
      setPushState(next)
    }).catch(() => {
      if (currentRevision === permissionRevision.current) setPushState('unknown')
    })
  }, [])
  useFocusEffect(useCallback(() => {
    refreshPushState()
    // Coming back from OS Settings is the common path; the card must read true.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshPushState()
    })
    return () => {
      permissionRevision.current += 1
      subscription.remove()
    }
  }, [refreshPushState]))

  async function openNotificationSettings() {
    setSettingsError(false)
    try {
      await Linking.openSettings()
    } catch {
      setSettingsError(true)
    }
  }

  return { pushState, settingsError, refreshPushState, openNotificationSettings }
}
