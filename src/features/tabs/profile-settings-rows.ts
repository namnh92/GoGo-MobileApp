import type { MaterialIconName } from '@/shared/ui/material-icon'

export const SETTINGS_ROWS: readonly { key: string; route: string; icon: MaterialIconName; group: 'settings' | 'experience'; userOnly?: boolean }[] = [
  { key: 'inbox', route: '/notifications', icon: 'unreadMail', group: 'settings', userOnly: true },
  { key: 'reviews', route: '/settings/reviews', icon: 'reviews', group: 'settings', userOnly: true },
  { key: 'notificationsLocation', route: '/settings/notifications', icon: 'shield', group: 'settings' },
  { key: 'account', route: '/settings/account', icon: 'manageAccounts', group: 'settings', userOnly: true },
  { key: 'contributions', route: '/me/contributions', icon: 'star', group: 'settings', userOnly: true },
  { key: 'defaults', route: '/settings/defaults', icon: 'tune', group: 'experience', userOnly: true },
  { key: 'theme', route: '/settings/theme', icon: 'palette', group: 'experience' },
]
