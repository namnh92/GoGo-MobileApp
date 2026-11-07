/**
 * Only rows with a destination are tappable, and every row has one. APP-058
 * (#216) folded "Thông báo" and "Vị trí" into one row: both are about what this
 * app may do on the device and for the account, and they now share one screen.
 * `/settings/location` still opens that screen for any older link. What the
 * privacy row promised — export and delete — lives on the account screen.
 */
import type { IconName } from '@/shared/ui/icons'

/** Each row leads with an icon from `icons.tsx`; the copy carries no emoji (#382). */
export const SETTINGS_ROWS: readonly { key: string; route?: string; icon: IconName }[] = [
  { key: 'inbox', route: '/notifications', icon: 'inbox' },
  { key: 'notificationsLocation', route: '/settings/notifications', icon: 'bell' },
  { key: 'contributions', route: '/me/contributions', icon: 'star' },
  { key: 'reviews', route: '/settings/reviews', icon: 'star' },
  { key: 'account', route: '/settings/account', icon: 'settings' },
]
