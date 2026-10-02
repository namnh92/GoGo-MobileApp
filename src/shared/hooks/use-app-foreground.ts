import { useSyncExternalStore } from 'react'

import { appActivity } from '@/shared/api/realtime/app-activity'

const subscribe = (onChange: () => void) => appActivity.subscribe(onChange)

/**
 * Whether the app is in the foreground. The same signal the realtime transport
 * pauses on, so a screen stops describing a connection the moment the
 * transport stops keeping one.
 */
export function useAppForeground(): boolean {
  return useSyncExternalStore(subscribe, appActivity.isActive, appActivity.isActive)
}
