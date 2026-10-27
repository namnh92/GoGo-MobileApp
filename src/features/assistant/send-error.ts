import type { TFunction } from 'i18next'

import { isApiError, isOffline, type AssistantStatus } from '@/shared/api'

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

/**
 * `status` is the latest `GET /assistant/status`: the limits are configurable
 * per environment, so any number shown comes from there, never from the app
 * (2.0.0-alpha.3). Without it the copy names no number.
 */
export function sendErrorCopy(error: unknown, t: TFunction, status?: Pick<AssistantStatus, 'messagesPerMinuteLimit'>): SendErrorCopy {
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
    if (error.status === 429) {
      const perMinute = status?.messagesPerMinuteLimit
      const body =
        typeof perMinute === 'number' && perMinute > 0
          ? t('assistant.error.busy.bodyLimit', { count: perMinute })
          : t('assistant.error.busy.body')
      return { title: t('assistant.error.busy.title'), body, retry: true }
    }
    if (error.status === 503 || error.code === 'ASSISTANT_DISABLED') {
      return { title: t('assistant.notice.disabled.title'), body: t('assistant.notice.disabled.body'), retry: true }
    }
    if (error.code === 'ASSISTANT_TURN_IN_PROGRESS') {
      return { title: t('assistant.error.inProgress.title'), body: t('assistant.error.inProgress.body'), retry: true }
    }
  }
  return { title: t('assistant.error.generic.title'), body: t('assistant.error.generic.body'), retry: true }
}
