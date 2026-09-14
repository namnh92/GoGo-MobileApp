import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  exportMyData,
  isApiError,
  isOffline,
  useMe,
  useRemoveAvatar,
  useSetAvatar,
  useUpdateProfile,
  useUploadImage,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { pickAvatar } from '@/shared/media/pick-avatar'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, LoadingState } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { Atmosphere, AvatarCircle, BackHeader, GhostBtn, GlassCard, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './account.style'
import { DateOfBirthCard } from './date-of-birth.view'
import { ProfileDefaultsCard } from './profile-defaults.view'

const MAX_NAME = 50

type AvatarStep = 'picking' | 'uploading' | 'removing' | null

/**
 * Which sentence a failed avatar change deserves. Codes come from the BFF
 * envelope (ADR-0022); the human message never does.
 */
function avatarErrorKey(error: unknown): string {
  if (isOffline(error)) return 'common.offlineBody'
  if (isApiError(error)) {
    if (error.code === 'AVATAR_UNPROCESSABLE' || error.code === 'UNSUPPORTED_CONTENT_TYPE') {
      return 'account.avatarUnreadable'
    }
    if (error.code === 'UPLOAD_NOT_CONFIGURED') return 'account.avatarUnavailable'
    if (error.code === 'AVATAR_BUSY' || error.code === 'AVATAR_STORAGE_UNAVAILABLE' || error.status === 429) {
      return 'account.avatarBusy'
    }
  }
  return 'account.avatarFailed'
}

export default function AccountScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status, deleteAccount } = useSession()

  const canManage = status === 'user'
  const me = useMe({ enabled: canManage })
  const updateProfile = useUpdateProfile()
  const upload = useUploadImage()
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()

  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [avatarStep, setAvatarStep] = useState<AvatarStep>(null)
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null)

  const displayName = name ?? me.data?.displayName ?? ''
  const dirty = displayName.trim() !== (me.data?.displayName ?? '') && displayName.trim().length > 0
  const initial = (me.data?.displayName ?? '?').trim().charAt(0).toUpperCase()
  // Known before the picker opens (ADR-0022): the server enforces it too, this
  // only keeps a control from looking operable when it is not.
  const canUpload = me.data?.capabilities?.avatarUpload === 'available'

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
   * Pick, downsize, presign + PUT, then attach. The picture on screen is the
   * one the server answers with — a local preview is never shown as saved,
   * because the server may still refuse the bytes.
   */
  async function changeAvatar() {
    if (!canUpload || avatarStep) return
    setAvatarNotice(null)
    setAvatarStep('picking')
    try {
      const picked = await pickAvatar()
      if (picked.status === 'canceled') return
      if (picked.status === 'denied') {
        setAvatarNotice(t('account.avatarPermissionDenied'))
        return
      }
      if (picked.status === 'unsupported') {
        setAvatarNotice(t('account.avatarUnsupportedType'))
        return
      }
      setAvatarStep('uploading')
      const key = await upload.mutateAsync({ image: picked.image, purpose: 'avatar' })
      await setAvatar.mutateAsync(key)
      haptic('success')
      track('profile_avatar_set')
      setAvatarNotice(t('account.avatarSaved'))
    } catch (error) {
      setAvatarNotice(t(avatarErrorKey(error)))
    } finally {
      setAvatarStep(null)
    }
  }

  async function removePicture() {
    if (avatarStep) return
    setAvatarNotice(null)
    setAvatarStep('removing')
    try {
      await removeAvatar.mutateAsync()
      haptic('success')
      track('profile_avatar_removed')
      setAvatarNotice(t('account.avatarRemoved'))
    } catch (error) {
      setAvatarNotice(t(avatarErrorKey(error)))
    } finally {
      setAvatarStep(null)
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
    // ADR-0023: the dialog states both halves. Promising to delete everything
    // and then keeping reviews is the one thing this confirmation must not do.
    Alert.alert(
      t('account.deleteTitle'),
      `${t('account.deleteBody')}\n\n${t('account.deleteKept')}`,
      [
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
      ],
    )
  }

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              <AvatarCircle label={initial} size={80} imageUri={me.data?.avatarUrl} />
              {avatarStep ? (
                <View style={styles.avatarOverlay} accessibilityElementsHidden>
                  <ActivityIndicator color={colors.neutral[0]} />
                </View>
              ) : null}
            </View>
            <View style={styles.avatarText}>
              <Text style={styles.sectionTitle}>{t('account.avatarTitle')}</Text>
              <Text style={canUpload ? styles.sectionBody : styles.avatarHint}>
                {canUpload ? t('account.avatarBody') : t('account.avatarUnavailable')}
              </Text>
            </View>
          </View>
          <View style={styles.avatarActions}>
            <SecondaryBtn
              label={avatarStep === 'uploading' ? t('account.avatarUploading') : t('account.avatarChange')}
              onPress={changeAvatar}
              disabled={!canUpload || avatarStep !== null}
              loading={avatarStep === 'picking' || avatarStep === 'uploading'}
              style={styles.avatarChangeBtn}
            />
            {me.data?.avatarUrl ? (
              <GhostBtn label={t('account.avatarRemove')} onPress={removePicture} disabled={avatarStep !== null} />
            ) : null}
          </View>
          {avatarNotice ? (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {avatarNotice}
            </Text>
          ) : null}
        </GlassCard>

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

        {/* Keyed by account: a different sign-in never inherits the last one's typing. */}
        {me.data ? <DateOfBirthCard key={me.data.id} profile={me.data} /> : null}

        {me.data ? <ProfileDefaultsCard profile={me.data} /> : null}

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
          <Text style={styles.sectionBody}>{t('account.deleteKept')}</Text>
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
