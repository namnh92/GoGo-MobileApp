import { createInstance } from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'

import type { Locale, LocaleContent } from '@/shared/i18n/types'
import { enContent, enMessages } from '@/shared/i18n/en'
import { viContent, viMessages } from '@/shared/i18n/vi'

export const locales: Locale[] = ['vi', 'en']

const contents: Record<Locale, LocaleContent> = { vi: viContent, en: enContent }

// vi is the product default; device-locale detection lands with the real
// session work once expo-localization is added behind the shared providers.
const i18n = createInstance()

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: viMessages },
    en: { translation: enMessages },
  },
  lng: 'vi',
  fallbackLng: 'vi',
  // Flat catalogs: keys contain dots ("gogoRoom.invite") as plain strings.
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
})

// Locale-dependent option datasets (arrays/objects) live outside i18next messages.
/**
 * The one supported locale a language tag stands for: `en-US` and `EN` are
 * `en`, anything else (`fr`, `''`, `constructor`, undefined) is the product
 * default. Code that formats outside React passes this same value to `t`
 * (`lng`) and to `localeContent`, so a template and its content never come
 * from two locales — i18next itself keeps a bare tag as typed (#412 F-01).
 */
export function resolveLocale(locale: string | undefined): Locale {
  const language = locale?.toLowerCase().split(/[-_]/)[0] ?? ''
  return locales.includes(language as Locale) ? (language as Locale) : 'vi'
}

// Locale-dependent option datasets (arrays/objects) live outside i18next messages.
export function localeContent(locale: string | undefined): LocaleContent {
  return contents[resolveLocale(locale)]
}

export function useLocaleContent(): LocaleContent {
  const { i18n: instance } = useTranslation()
  return localeContent(instance.resolvedLanguage)
}

export default i18n
