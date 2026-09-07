import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { exportMyData, useMe, useUpdateProfile } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './account.style'

const MAX_NAME = 50

export default function AccountScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status, deleteAccount } = useSession()

  const canManage = status === 'user'
  const me = useMe({ enabled: canManage })
  const updateProfile = useUpdateProfile()

  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const displayName = name ?? me.data?.displayName ?? ''
  const dirty = displayName.trim() !== (me.data?.displayName ?? '') && displayName.trim().length > 0

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('account.title')} />
    </View>
  )

  if (!canManage) {
    return (
      <Atmosphere>
        {header}
        <EmptyState
          title={t('notifications.signInTitle')}
          body={t('account.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />}
        />
      </Atmosphere>
    )
  }

  if (me.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
      </Atmosphere>
    )
  }

  async function saveName() {
    setNotice(null)
    try {
      await updateProfile.mutateAsync({ displayName: displayName.trim() })
      setName(null)
      setNotice(t('account.saved'))
    } catch {
      setNotice(t('account.saveFailed'))
    }
  }

  /**
   * The export is audit-logged and rate-limited server-side (3/hour), so it is
   * requested on demand and handed straight to the share sheet — the app keeps
   * no copy of it.
   */
  async function onExport() {
    setNotice(null)
    setBusy('export')
    try {
      const data = await exportMyData()
      await Share.share({ message: JSON.stringify(data, null, 2) })
    } catch {
      setNotice(t('account.exportFailed'))
    } finally {
      setBusy(null)
    }
  }

  function onDelete() {
    // Irreversible, so it asks in the platform's own dialog rather than
    // relying on a button the thumb can reach by accident.
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('account.deleteCancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          setBusy('delete')
          deleteAccount()
            .then(() => router.replace('/(tabs)'))
            .catch(() => setNotice(t('account.deleteFailed')))
            .finally(() => setBusy(null))
        },
      },
    ])
  }

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard style={styles.card}>
          <Text style={styles.label}>{t('auth.displayName')}</Text>
          <TextInput
            value={displayName}
            onChangeText={value => setName(value.slice(0, MAX_NAME))}
            placeholder={t('auth.displayNamePlaceholder')}
            placeholderTextColor={colors.neutral[500]}
            autoCapitalize="words"
            accessibilityLabel={t('auth.displayName')}
            style={styles.input}
          />
          <Text style={styles.email}>{me.data?.email ?? ''}</Text>
          <PrimaryBtn
            label={updateProfile.isPending ? t('account.saving') : t('account.save')}
            onPress={saveName}
            disabled={!dirty}
            loading={updateProfile.isPending}
            style={styles.saveBtn}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t('account.dataTitle')}</Text>
          <Text style={styles.sectionBody}>{t('account.exportBody')}</Text>
          <GhostBtn
            label={busy === 'export' ? t('account.exporting') : t('account.export')}
            onPress={onExport}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t('account.deleteTitle')}</Text>
          <Text style={styles.sectionBody}>{t('account.deleteBody')}</Text>
          <Pressable
            onPress={onDelete}
            disabled={busy === 'delete'}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy === 'delete', busy: busy === 'delete' }}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteLabel}>
              {busy === 'delete' ? t('account.deleting') : t('account.deleteConfirm')}
            </Text>
          </Pressable>
        </GlassCard>

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>
    </Atmosphere>
  )
}
