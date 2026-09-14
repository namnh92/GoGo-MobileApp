/**
 * Only rows with a destination are tappable, and every row has one. APP-058
 * (#216) folded "Thông báo" and "Vị trí" into one row: both are about what this
 * app may do on the device and for the account, and they now share one screen.
 * `/settings/location` still opens that screen for any older link. What the
 * privacy row promised — export and delete — lives on the account screen.
 */
export const SETTINGS_ROWS: readonly { key: string; route?: string }[] = [
  { key: 'inbox', route: '/notifications' },
  { key: 'notificationsLocation', route: '/settings/notifications' },
  { key: 'reviews', route: '/settings/reviews' },
  { key: 'account', route: '/settings/account' },
]
