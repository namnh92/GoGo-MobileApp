import type { TFunction } from 'i18next'

import { isApiError, isOffline } from '@/shared/api'

import { formatClock } from './format'

/**
 * What a failed send says under the "Not sent" message (GoGo-MobileApp#378).
 * The message is always kept; `retry` says whether trying again can help.
 */
export interface SendErrorCopy {
  title: string
  body: string
  retry: boolean
}

/** The account cannot use GoGo AI (a guest): the screen asks it to sign in instead. */
export function isUserOnly(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code === 'USER_ONLY'
}

export function sendErrorCopy(error: unknown, t: TFunction): SendErrorCopy {
  if (isOffline(error)) return { title: t('assistant.error.network.title'), body: t('assistant.error.network.body'), retry: true }
  if (isApiError(error)) {
    if (error.code === 'ASSISTANT_DAILY_LIMIT') {
      const at = error.retryAt > 0 ? formatClock(new Date(error.retryAt).toISOString()) : null
      return {
        title: t('assistant.notice.limit.title'),
        body: at ? t('assistant.notice.limit.body', { time: at }) : t('assistant.notice.disabled.body'),
        retry: false,
      }
    }
    if (error.status === 429) return { title: t('assistant.error.busy.title'), body: t('assistant.error.busy.body'), retry: true }
    if (error.status === 503 || error.code === 'ASSISTANT_DISABLED') {
      return { title: t('assistant.notice.disabled.title'), body: t('assistant.notice.disabled.body'), retry: true }
    }
    if (error.code === 'ASSISTANT_TURN_IN_PROGRESS') {
      return { title: t('assistant.error.inProgress.title'), body: t('assistant.error.inProgress.body'), retry: true }
    }
  }
  return { title: t('assistant.error.generic.title'), body: t('assistant.error.generic.body'), retry: true }
}
