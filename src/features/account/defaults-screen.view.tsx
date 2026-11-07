import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useMe } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState, OfflineState } from '@/shared/ui/async-state.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { SettingsPage } from '@/features/settings/settings-page.view'
import { ProfileDefaultsCard } from './profile-defaults.view'

export default function DefaultsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' })
  const waiting = useWaitingForNetwork(me)
  return <SettingsPage title={t('account.defaultsTitle')}>
    {status !== 'user' ? <EmptyState title={t('notifications.signInTitle')} body={t('account.signInBody')} action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} />
      : me.isPending ? (waiting ? <OfflineState /> : <LoadingState />)
      : me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      : me.data ? <ProfileDefaultsCard key={me.data.id} profile={me.data} /> : null}
  </SettingsPage>
}
