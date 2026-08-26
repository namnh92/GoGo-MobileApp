import type { viContent, viMessages } from '@/shared/i18n/vi'

export type Locale = 'vi' | 'en'
export type MessageKey = keyof typeof viMessages
export type LocaleContent = typeof viContent
