import type { MessageKey } from '@/shared/i18n/types'
import type { IconName } from '@/shared/ui/icons'

/** What a row shows for each kind the API sends today; anything else gets the fallback. */
const KINDS = {
  campaign: { icon: 'zap', body: 'notifications.body.campaign' },
  invite: { icon: 'users', body: 'notifications.body.invite' },
  preference_reminder: { icon: 'sliders', body: 'notifications.body.preference_reminder' },
  plan_ready: { icon: 'sparkle', body: 'notifications.body.plan_ready' },
  plan_changed: { icon: 'history', body: 'notifications.body.plan_changed' },
  date_reminder: { icon: 'bell', body: 'notifications.body.date_reminder' },
  moderation_update: { icon: 'info', body: 'notifications.body.moderation_update' },
} as const satisfies Record<string, { icon: IconName; body: MessageKey }>

type KnownKind = keyof typeof KINDS

/** An unknown or missing kind is a neutral bell and no body line, never a crash. */
export function kindPresentation(kind: string | undefined): { icon: IconName; body: (typeof KINDS)[KnownKind]['body'] | null } {
  if (kind && Object.prototype.hasOwnProperty.call(KINDS, kind)) return KINDS[kind as KnownKind]
  return { icon: 'bell', body: null }
}
