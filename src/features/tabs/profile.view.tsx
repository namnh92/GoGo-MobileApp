import { Chip } from '@/shared/ui/chip.view'
import { AppHeader } from '@/shared/ui/app-header.view'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { useMe, useMyReviews, useMyRooms, useNotificationSettings, useSaved, useTaxonomies } from '@/shared/api'
import { track } from '@/shared/analytics'
import { getSession, type Session } from '@/shared/api/session'
import { useSession } from '@/shared/providers/session-provider'
import { signOutFailureReason, type SignOutFailure } from '@/shared/providers/sign-out-failure'
import { Atmosphere, AvatarCircle, Card, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { IconChevronRight } from '@/shared/ui/icons'
import { MaterialIcon, type MaterialIconName } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { accentOf, DEFAULT_ACCENT } from '@/shared/ui/theme'
import { useUnistyles } from 'react-native-unistyles'
import { BuildVersion } from '@/features/settings/settings-page.view'
import { ErrorState, LoadingState, OfflineState } from '@/shared/ui/async-state.view'
import { ProfileUpcoming } from './profile-upcoming.view'
import { SETTINGS_ROWS } from './profile-settings-rows'
import { useMyPlaceSubmissions } from '@/shared/api/queries/use-my-place-submissions'
import { profileKeoCount } from './profile-keo-count'
import { styles } from './profile.style'

const SHORTCUT_ICON: Record<string, MaterialIconName> = { saved: 'bookmarkFilled', plans: 'groups', reviews: 'hotelClass', contributions: 'edit' }
function actorKeyOf(session: Session | null): string {
  return session ? `${session.kind}:${session.userId ?? ''}:${session.guestSessionId ?? ''}` : ''
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const { rt } = useUnistyles()
  const router = useRouter()
  const fab = useAssistantFabScroll('profile')
  const { session, status, signOut } = useSession()
  const canRead = status === 'user'
  const me = useMe({ enabled: canRead })
  const waiting = useWaitingForNetwork(me)
  const taxonomy = useTaxonomies({ kinds: 'mood' })
  const saved = useSaved({ enabled: canRead })
  const reviews = useMyReviews({ enabled: canRead })
  const submissions = useMyPlaceSubmissions(canRead)
  const submissionPages = submissions.data?.pages
  const contributionCount = canRead && !submissions.isError && submissionPages?.length
    ? `${new Set(submissionPages.flatMap(page => page.items.map(item => item.id))).size}${submissionPages[submissionPages.length - 1].nextCursor ? '+' : ''}` : undefined
  const contributionLoading = canRead && submissions.isPending && !submissions.isError
  const canReadRooms = canRead || status === 'guest'
  const rooms = useMyRooms({ enabled: canReadRooms })
  const keoCount = canReadRooms && !rooms.isError ? profileKeoCount(rooms.data?.pages) : undefined
  const keoLoading = canReadRooms && rooms.isPending && !rooms.isError
  useNotificationSettings({ enabled: canRead })
  const [signingOut, setSigningOut] = useState(false)
  const signOutQueued = useRef<string | null>(null)
  const [logoutResultReady, setLogoutResultReady] = useState(false)
  const [logoutOverlayClosed, setLogoutOverlayClosed] = useState(true)
  if (signingOut && logoutOverlayClosed) setLogoutOverlayClosed(false)
  const [logoutConfirm, setLogoutConfirm] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [failed, setFailed] = useState<{ reason: SignOutFailure; actor: string } | null>(null)
  const actor = actorKeyOf(session)
  useEffect(() => { signOutQueued.current = null }, [actor])
  const [dialogActor, setDialogActor] = useState(actor)
  // The mounted tab may change accounts. Reset only transient dialogs before
  // rendering the new actor; sign-out results keep their existing actor tags.
  if (dialogActor !== actor) {
    setDialogActor(actor)
    setLogoutConfirm(null)
    setLocked(false)
  }
  const signOutFailure = failed && failed.actor === actor ? failed.reason : null
  const profile = canRead ? me.data : undefined
  const moodEntries = taxonomy.data?.kinds?.mood ?? []
  const interests = profile?.interests?.mood?.flatMap(key => {
    const entry = moodEntries.find(item => item.key === key)
    const label = entry?.labels?.[i18n.language] ?? entry?.labels?.vi
    return label ? [label] : []
  }) ?? []
  const shortcuts = [
    { key: 'saved', route: '/(tabs)/saved', count: canRead ? saved.data?.length : undefined, userOnly: true },
    { key: 'plans', route: '/(tabs)/plans', count: keoCount, userOnly: false },
    { key: 'reviews', route: '/me/contributions?tab=reviews', count: canRead ? reviews.data?.length : undefined, userOnly: true },
    { key: 'contributions', route: '/me/contributions?tab=places', count: contributionCount, userOnly: true },
  ]
  async function signOutNow() {
    setLogoutResultReady(true)
    setSigningOut(true)
    setFailed(null)
    try {
      // Unsubscribes this device and has the provider confirm it, revokes
      // server-side, and only then wipes the Keychain and cached rooms.
      await signOut()
      track('auth_signed_out')
      router.replace('/(tabs)')
    } catch (error) {
      // NTF-APP-004 (#160): a sign-out that did not happen has to say so.
      // Without this the rejection is unhandled — a dev-build toast, and in a
      // release build nothing at all, leaving a button that silently does
      // nothing while the person believes they signed out. #279: and it has to
      // say why, so nobody is sent to check a connection that is fine.
      const current = getSession()
      const reason = signOutFailureReason(error, current !== null)
      track('auth_sign_out_failed', { reason })
      setFailed({ reason, actor: actorKeyOf(current) })
      // The credential was already dead and the session ended locally (F-02):
      // the person is signed out, so they go where a sign-out goes.
      if (reason === 'session_ended') router.replace('/(tabs)')
    } finally {
      setSigningOut(false)
    }
  }

  return <Atmosphere redesign>
    <AppHeader variant="tab-root" title={t('g11.profileHeading')} bellTestID="profile-bell" unreadDotTestID="profile-unread" />
    <ScrollView testID="profile-list" onScroll={fab.onScroll} scrollEventThrottle={fab.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: 0, paddingBottom: fab.bottomInset }}>
      {canRead && (me.isPending ? (waiting ? <OfflineState /> : <LoadingState />) : me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : (
        <Card testID="profile-identity-card" appearance="stitch" padded={false} style={styles.headerCard}>
          <View style={styles.identity}>
            <AvatarCircle label={(profile?.displayName ?? t('profile.guestName')).trim().charAt(0).toUpperCase()} size={64} imageUri={profile?.avatarUrl} />
            <View style={styles.identityText}>
              <Text variant="introHeading" color="text.primary">{canRead ? profile?.displayName : t('profile.title')}</Text>
              {!canRead ? <Text variant="bodySmall" color="text.secondary">{t('profile.guestSubtitle')}</Text> : null}
              {profile?.email ? <Text variant="introSmall" color="text.secondary" numberOfLines={1}>{profile.email}</Text> : null}
              {profile?.homeAdministrativeArea?.provinceName ? <Text variant="introCaption" color="text.secondary" numberOfLines={1}>{profile.homeAdministrativeArea.provinceName}</Text> : null}
            </View>
            {canRead ? <IconBtn style={styles.edit} accessibilityLabel={t('g11.editProfile')} onPress={() => router.push('/settings/account')}><MaterialIcon name="edit" size={20} color="text.secondary" /></IconBtn> : null}
          </View>
          {interests.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.interests}>{interests.map(label => <Chip key={label} label={label} />)}</ScrollView> : null}
        </Card>
      ))}
      {!canRead ? <>
        <Card appearance="stitch" padded={false} style={styles.card}>
          <Text variant="title2">{t('g11.unlock')}</Text><Text color="text.secondary">{t('g11.unlockBody')}</Text>
          <PrimaryBtn label={t('g11.signIn')} onPress={() => router.push('/auth/sign-in')} />
        </Card>
      </> : null}
      <View style={styles.shortcutRow}>{shortcuts.map(shortcut => {
        const isLocked = !canRead && shortcut.userOnly
        return <Pressable key={shortcut.key} accessibilityRole="button" accessibilityLabel={shortcut.count === undefined ? t(`profile.shortcut.${shortcut.key}`) : `${t(`profile.shortcut.${shortcut.key}`)}: ${shortcut.count}`}
          accessibilityState={{ busy: shortcut.key === 'plans' ? keoLoading : shortcut.key === 'contributions' ? contributionLoading : false }}
          accessibilityHint={isLocked ? t('g11.userOnly') : undefined}
          onPress={() => isLocked ? setLocked(true) : router.push(shortcut.key === 'plans' ? { pathname: '/(tabs)/plans', params: { showUpcoming: String(Date.now()) } } : shortcut.route)}
          style={({ pressed }) => [styles.shortcutPress, pressed && styles.settingRowPressed]}>
          <Card appearance="stitch" padded={false} style={styles.shortcut}>
            <View style={[styles.shortcutIcon, shortcut.key === 'plans' && styles.plansIcon, shortcut.key === 'reviews' && styles.reviewsIcon]}><MaterialIcon name={isLocked ? 'lock' : SHORTCUT_ICON[shortcut.key]} size={20} color={shortcut.key === 'plans' ? 'status.infoText' : 'accent.text'} /></View>
            {(shortcut.key === 'plans' && keoLoading) || (shortcut.key === 'contributions' && contributionLoading) ? <View testID={shortcut.key === 'plans' ? 'profile-keo-loading' : 'profile-contributions-loading'}><Skeleton width={40} height={24} /></View> : shortcut.count !== undefined ? <Text variant="introHeading" color="text.primary">{shortcut.count}</Text> : null}
            <Text variant="introCaption" color="text.secondary" style={styles.shortcutLabel}>{t(`profile.shortcut.${shortcut.key}`)}</Text>
            {isLocked ? <Text variant="introCaption" color="text.secondary" style={styles.shortcutLabel}>{t('g11.userOnly')}</Text> : null}
          </Card>
        </Pressable>
      })}</View>
      {!canRead ? <Card appearance="stitch" padded={false} style={styles.card}><Text variant="bodySmall" color="text.secondary">{t('g11.guestHint')}</Text><GhostBtn label={t('joinByCode.title')} onPress={() => router.push('/join')} /></Card> : null}
      <ProfileUpcoming enabled={canRead} />
      {(['settings', 'experience'] as const).map(group => {
        const rows = SETTINGS_ROWS.filter(row => row.group === group && (canRead || !row.userOnly))
        if (!rows.length) return null
        return <View key={group}>
          <Text variant="introLabel" color="text.secondary" style={styles.groupTitle}>{t(group === 'settings' ? 'g11.settings' : 'g11.experienceHeading')}</Text>
          <Card appearance="stitch" padded={false} style={styles.settingsCard}>{rows.map((row, index) => <Pressable key={row.key} onPress={() => router.push(row.route)} accessibilityRole="button"
            testID={`profile-setting-${t(`profile.settings.${row.key}`)}`} style={({ pressed }) => [styles.settingRow, index === rows.length - 1 && styles.settingRowLast, pressed && styles.settingRowPressed]}>
            <View style={styles.settingLead}><View style={styles.settingIconTile}><MaterialIcon name={row.icon} size={20} /></View><Text variant="introBody" color="text.primary" style={styles.settingLabel}>{t(row.key === 'inbox' ? 'g11.inbox' : row.key === 'account' ? 'g11.account' : `profile.settings.${row.key}`)}</Text></View>
            {row.key === 'theme' ? <View style={styles.rowTail}><View style={styles.accentDot} /><Text variant="introCaption" color="text.secondary">{t(`theme.${accentOf(rt.themeName) ?? DEFAULT_ACCENT}`)}</Text></View> : null}
            {row.key === 'defaults' && profile?.homeAdministrativeArea?.provinceName ? <Text variant="caption" numberOfLines={1} style={styles.rowValue} color="text.secondary">{profile.homeAdministrativeArea.provinceName}</Text> : null}
            {row.key === 'reviews' && reviews.data ? <Text variant="introCaption" color="text.secondary">{t('g11.reviewCount', { count: reviews.data.length })}</Text> : null}
            <IconChevronRight />
          </Pressable>)}</Card>
        </View>
      })}
      {status !== 'anonymous' ? <SecondaryBtn label={signingOut ? t('profile.loggingOut') : t('g11.logout')} onPress={() => setLogoutConfirm(actor)} disabled={signingOut} loading={signingOut} style={styles.logout} leadingIcon="logout" /> : null}
      <BuildVersion />
    </ScrollView>
    <ResultSheet visible={locked && !canRead} variant="info" title={t('notifications.signInTitle')} body={t('g11.userOnly')}
      primaryAction={{ label: t('auth.signInCta'), onPress: () => { setLocked(false); router.push('/auth/sign-in') } }} onClose={() => setLocked(false)} />
    <ResultSheet visible={logoutConfirm !== null && logoutConfirm === actor} variant="warning"
      testID="profile-logout-confirm" title={t('g11.logoutTitle')} body={t('g11.logoutBody')}
      primaryAction={{ label: t('g11.logoutConfirm'), destructive: true, onPress: () => { signOutQueued.current = actor; setLogoutConfirm(null) } }}
      secondaryAction={{ label: t('common.cancel'), onPress: () => setLogoutConfirm(null) }} onClose={() => setLogoutConfirm(null)}
      onClosed={() => { const queued = signOutQueued.current; signOutQueued.current = null; if (queued === actor) void signOutNow() }} />
    <BlockingLoadingOverlay visible={signingOut} accessibilityLabel={t('profile.loggingOut')} onClosed={() => setLogoutOverlayClosed(true)} />
    <ResultSheet visible={!!signOutFailure && logoutResultReady && logoutOverlayClosed} variant="error" title={t('profile.logout')}
      body={signOutFailure ? t(({ offline: 'profile.logoutFailedOffline', timeout: 'profile.logoutFailedTimeout', push_unconfirmed: 'profile.logoutFailedPush', session_ended: 'profile.logoutSessionEnded', other: 'profile.logoutFailed' } as const)[signOutFailure]) : ''}
      primaryAction={{ label: t('common.close'), onPress: () => setLogoutResultReady(false) }} onClose={() => setLogoutResultReady(false)} />
  </Atmosphere>
}
