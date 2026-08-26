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
export function useLocaleContent(): LocaleContent {
  const { i18n: instance } = useTranslation()
  return contents[instance.resolvedLanguage as Locale] ?? viContent
}

export default i18n
