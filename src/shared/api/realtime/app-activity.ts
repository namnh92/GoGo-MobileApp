import { AppState, type AppStateStatus } from 'react-native'

/**
 * Whether the app is in the foreground, as a subscription. Its own module so
 * the transport can be tested without React Native — vitest here runs in
 * plain Node, and `react-native` does not load there.
 */
export interface AppActivity {
  isActive: () => boolean
  /** Calls back on every change; returns the unsubscribe. */
  subscribe: (listener: (active: boolean) => void) => () => void
}

const isActiveStatus = (status: AppStateStatus | null | undefined): boolean =>
  status === 'active' || status == null

export const appActivity: AppActivity = {
  isActive: () => isActiveStatus(AppState.currentState),
  subscribe: listener => {
    const subscription = AppState.addEventListener('change', status => {
      listener(isActiveStatus(status))
    })
    return () => subscription.remove()
  },
}
