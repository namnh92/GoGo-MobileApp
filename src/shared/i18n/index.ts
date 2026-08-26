import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import { en } from './en'
import { vi } from './vi'

// vi is the product default; device-locale detection lands with APP-002+ once
// expo-localization is added behind the shared providers.
const i18n = createInstance()

void i18n.use(initReactI18next).init({
  resources: { vi, en },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
})

export default i18n
