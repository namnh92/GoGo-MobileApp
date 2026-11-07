import { useTranslation } from 'react-i18next'
import { SettingsPage } from '@/features/settings/settings-page.view'
import { ThemeAccentCard } from './theme-accent.view'

export default function ThemeScreen() {
  const { t } = useTranslation()
  return <SettingsPage title={t('account.themeTitle')}><ThemeAccentCard /></SettingsPage>
}
