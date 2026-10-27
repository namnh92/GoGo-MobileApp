import type { TFunction } from 'i18next'

import { isApiError, isOffline, type AssistantStatus } from '@/shared/api'

import type { IconName } from '@/shared/ui/icons'

import { formatClock } from './format'

/**
 * What a failed send says under the "Not sent" message (GoGo-MobileApp#378).
 * The message is always kept; `retry` says whether trying again can help.
 */
export interface SendErrorCopy {
  title: string
  body: string
  retry: boolean
  /**
   * What it is about. `limit` and `disabled` say the same as the status
   * notice the screen draws for `limit_reached` / `disabled`, so the thread
   * shows only one of them (acceptance BUG4).
   */
  reason: 'network' | 'limit' | 'busy' | 'disabled' | 'inProgress' | 'generic'
  /** The notice's glyph when it is not the default error one (wifi-off). */
  icon?: IconName
}

/** The account cannot use GoGo AI (a guest): the screen asks it to sign in instead. */
export function isUserOnly(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code === 'USER_ONLY'
}

/**
 * `status` is the latest `GET /assistant/status`: the limits are configurable
 * per environment, so any number shown comes from there, never from the app
 * (2.0.0-alpha.3). Without it the copy names no number.
 *
 * The daily limit resets at `status.resetsAt` (midnight Asia/Ho_Chi_Minh,
 * contract 2.0.0-alpha.3); the 429's `Retry-After` points at the same moment
 * and is only the fallback before a status has arrived — two sources gave two
 * different times on one screen (acceptance BUG4).
 */
export function sendErrorCopy(
  error: unknown,
  t: TFunction,
  status?: Pick<AssistantStatus, 'messagesPerMinuteLimit' | 'resetsAt'>,
): SendErrorCopy {
  if (isOffline(error)) {
    return { title: t('assistant.error.network.title'), body: t('assistant.error.network.body'), retry: true, reason: 'network' }
  }
  if (isApiError(error)) {
    if (error.code === 'ASSISTANT_DAILY_LIMIT') {
      const resetsAt = status?.resetsAt ?? (error.retryAt > 0 ? new Date(error.retryAt).toISOString() : null)
      return {
        title: t('assistant.notice.limit.title'),
        body: resetsAt ? t('assistant.notice.limit.body', { time: formatClock(resetsAt) }) : t('assistant.notice.disabled.body'),
        retry: false,
        reason: 'limit',
        icon: 'clock',
      }
    }
    if (error.status === 429) {
      const perMinute = status?.messagesPerMinuteLimit
      const body =
        typeof perMinute === 'number' && perMinute > 0
          ? t('assistant.error.busy.bodyLimit', { count: perMinute })
          : t('assistant.error.busy.body')
      return { title: t('assistant.error.busy.title'), body, retry: true, reason: 'busy' }
    }
    if (error.status === 503 || error.code === 'ASSISTANT_DISABLED') {
      return { title: t('assistant.notice.disabled.title'), body: t('assistant.notice.disabled.body'), retry: true, reason: 'disabled', icon: 'info' }
    }
    if (error.code === 'ASSISTANT_TURN_IN_PROGRESS') {
      return { title: t('assistant.error.inProgress.title'), body: t('assistant.error.inProgress.body'), retry: true, reason: 'inProgress' }
    }
  }
  return { title: t('assistant.error.generic.title'), body: t('assistant.error.generic.body'), retry: true, reason: 'generic' }
}
