import type { IconName } from '@/shared/ui/icons'

export const SETTINGS_ROWS: readonly { key: string; route: string; icon: IconName; group: 'settings' | 'experience'; userOnly?: boolean }[] = [
  { key: 'inbox', route: '/notifications', icon: 'inbox', group: 'settings', userOnly: true },
  { key: 'reviews', route: '/settings/reviews', icon: 'star', group: 'settings', userOnly: true },
  { key: 'contributions', route: '/me/contributions', icon: 'star', group: 'settings', userOnly: true },
  { key: 'notificationsLocation', route: '/settings/notifications', icon: 'bell', group: 'settings' },
  { key: 'account', route: '/settings/account', icon: 'settings', group: 'settings', userOnly: true },
  { key: 'defaults', route: '/settings/defaults', icon: 'sliders', group: 'experience', userOnly: true },
  { key: 'theme', route: '/settings/theme', icon: 'sparkle', group: 'experience' },
]
