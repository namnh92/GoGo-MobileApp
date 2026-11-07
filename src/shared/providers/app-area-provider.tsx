import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { useMe } from '@/shared/api'
import { appActivity } from '@/shared/api/realtime/app-activity'
import { appArea, initializeAppArea } from '@/shared/location/app-area'
import { useSession } from './session-provider'

/** The only startup resolver and permission-change subscription in the app. */
export function AppAreaProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' })
  const ready = status !== 'hydrating' && (status !== 'user' || !me.isPending || me.isPaused)
  const profile = status === 'user' ? me.data?.homeAdministrativeArea : null
  useEffect(() => {
    if (!ready) return
    void initializeAppArea(client, profile)
    return appActivity.subscribe(active => { if (active) void appArea.permissionChanged() })
  }, [client, ready, profile])
  return children
}
