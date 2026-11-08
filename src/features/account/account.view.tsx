import { AppHeader, AppHeaderAction } from '@/shared/ui/app-header.view'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, Linking, Pressable, ScrollView, Share, View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import {
  exportMyData,
  isApiError,
  isOffline,
  useMe,
  useRemoveAvatar,
  useSetAvatar,
  useUpdateProfile,
  useUploadImage,
  type OpBody,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { cropAvatar, selectAvatar, type AvatarSource, type PickedAsset } from '@/shared/media/pick-avatar'
import type { AvatarAdjustment } from '@/shared/media/avatar-crop'
import { MediaPermissionSheet, type MediaPermissionIssue } from '@/shared/media/media-permission-sheet.view'
import { AvatarEditor } from './avatar-editor.view'
import { AvatarSourceSheet } from './avatar-source-sheet.view'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, LoadingState } from '@/shared/ui/async-state.view'
import { useDialog } from '@/shared/ui/dialog.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { haptic } from '@/shared/ui/feedback'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, AvatarCircle, Card, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import type { MessageKey } from '@/shared/i18n/types'

import { styles } from './account.style'
import { DateOfBirthCard } from './date-of-birth.view'
import { checkTypedDateOfBirth, isoToTyped, typedToIso } from './date-of-birth'

const MAX_NAME = 50
const schema = z.object({
  name: z.string().trim().min(1, 'account.nameInvalid').max(MAX_NAME, 'account.nameInvalid'),
  birthday: z.string(),
}).superRefine((value, ctx) => {
  if (!value.birthday.trim()) return
  const check = checkTypedDateOfBirth(value.birthday)
  if (!check.ok) ctx.addIssue({ code: 'custom', path: ['birthday'], message: check.reason === 'future' ? 'account.dobFuture' : 'account.dobInvalid' })
})

type AvatarStep = 'picking' | 'uploading' | 'removing' | null

/**
 * Which sentence a failed avatar change deserves. Codes come from the BFF
 * envelope (ADR-0022); the human message never does.
 */
function avatarErrorKey(error: unknown): MessageKey {
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
  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' })
  // A newly authenticated account owns a fresh form and cannot inherit late UI feedback.
  return <AccountEditor key={`${status}:${me.data?.id ?? ''}`} me={me} />
}

function AccountEditor({ me }: { me: ReturnType<typeof useMe> }) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status, deleteAccount } = useSession()

  const canManage = status === 'user'
  const updateProfile = useUpdateProfile()
  const upload = useUploadImage()
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()

  const serverValues = {
    name: me.data?.displayName ?? '', birthday: isoToTyped(me.data?.dateOfBirth),
  }
  const form = useForm({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: serverValues,
    // Refetches replace untouched values while preserving edits in progress.
    values: serverValues, resetOptions: { keepDirtyValues: true },
  })
  const values = useWatch({ control: form.control })
  const { dirtyFields } = form.formState
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [avatarStep, setAvatarStep] = useState<AvatarStep>(null)
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null)
  const [avatarSheet, setAvatarSheet] = useState(false)
  const [avatarAsset, setAvatarAsset] = useState<(PickedAsset & { width: number; height: number }) | null>(null)
  const avatarLock = useRef(false)
  const pendingSource = useRef<AvatarSource | 'remove' | 'settings' | null>(null)
  const [permissionIssue, setPermissionIssue] = useState<MediaPermissionIssue | null>(null)
  const { confirm, dialog } = useDialog()
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const nameDirty = !!dirtyFields.name && (values.name ?? '').trim() !== serverValues.name
  const birthdayText = (values.birthday ?? '').trim()
  const birthdayDate = typedToIso(birthdayText)
  const birthdayDirty = !!dirtyFields.birthday
    && ((birthdayText !== '' && birthdayDate === null) || birthdayDate !== (me.data?.dateOfBirth ?? null))
  const dirty = nameDirty || birthdayDirty
  const { resetField } = form
  useEffect(() => {
    // A draft that converged with the server is clean and should follow later
    // refetches too. Keep its typed formatting rather than changing text mid-edit.
    if (dirtyFields.name && !nameDirty) resetField('name', { defaultValue: values.name })
    if (dirtyFields.birthday && !birthdayDirty) resetField('birthday', { defaultValue: values.birthday })
  }, [dirtyFields.name, dirtyFields.birthday, nameDirty, birthdayDirty, resetField, values.name, values.birthday])
  const valid = schema.safeParse(values).success
  const initial = (me.data?.displayName ?? '?').trim().charAt(0).toUpperCase()
  // Known before the picker opens (ADR-0022): the server enforces it too, this
  // only keeps a control from looking operable when it is not.
  const canUpload = me.data?.capabilities?.avatarUpload === 'available'

  async function goBack() {
    if (inFlight.current) return
    if (!dirty) { router.back(); return }
    const choice = await confirm({ title: t('account.unsavedTitle'), message: t('account.unsavedBody'), actions: [
      { key: 'keep', label: t('draft.keepEditing'), style: 'cancel' },
      { key: 'discard', label: t('account.discard'), style: 'destructive' },
    ] })
    if (choice === 'discard') router.back()
  }

  async function save() {
    const parsed = schema.safeParse(form.getValues())
    if (inFlight.current || !dirty || !parsed.success) return
    const submitted = parsed.data
    const check = submitted.birthday.trim() ? checkTypedDateOfBirth(submitted.birthday) : null
    const dateOfBirth = check?.ok ? check.iso : null
    const patch: OpBody<'updateProfile'> = {}
    if (dirtyFields.name && submitted.name !== serverValues.name) patch.displayName = submitted.name
    const birthdayChanged = !!dirtyFields.birthday && dateOfBirth !== (me.data?.dateOfBirth ?? null)
    if (birthdayChanged) patch.dateOfBirth = dateOfBirth
    if (!Object.keys(patch).length) return
    inFlight.current = true
    setSaving(true)
    setNotice(null)
    form.clearErrors()
    try {
      await updateProfile.mutateAsync(patch)
      if (!mounted.current) return
      // An untouched field may have refetched while the request was pending.
      const current = form.getValues()
      form.reset({ name: current.name.trim(), birthday: isoToTyped(typedToIso(current.birthday)) })
      haptic('success')
      if (birthdayChanged) track(dateOfBirth === null ? 'profile_date_of_birth_cleared' : 'profile_date_of_birth_saved')
      setNotice(t('account.saved'))
    } catch (error) {
      if (!mounted.current) return
      const fields = isApiError(error) ? error.fieldErrors : []
      const message = isOffline(error) ? 'common.offlineBody' : 'account.saveFailed'
      if (!fields.length) {
        form.setError('name', { message })
        form.setError('birthday', { message })
      } else {
        for (const field of fields) {
          if (field.field === 'displayName') form.setError('name', { message: 'account.nameInvalid' })
          else if (field.field === 'dateOfBirth') form.setError('birthday', { message: (field as { code?: string }).code === 'too_big' ? 'account.dobFuture' : 'account.dobInvalid' })
          else setNotice(t(message))
        }
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setSaving(false)
    }
  }

  function chooseAvatarSource(source: AvatarSource | 'remove') {
    pendingSource.current = source
    setAvatarSheet(false)
  }

  function sourceSheetClosed() {
    const source = pendingSource.current
    pendingSource.current = null
    if (!mounted.current || !source) return
    if (source === 'settings') void Linking.openSettings().catch(() => { if (mounted.current) setAvatarNotice(t('account.avatarFailed')) })
    else if (source === 'remove') void removePicture()
    else void changeAvatar(source)
  }

  async function changeAvatar(source: AvatarSource) {
    if (!canUpload || avatarLock.current) return
    avatarLock.current = true
    setAvatarNotice(null)
    setPermissionIssue(null)
    setAvatarStep('picking')
    try {
      // The upstream picker can resolve during UIKit dismissal. The editor
      // replaces this screen's content, so it presents no competing native modal.
      const picked = await selectAvatar(source)
      if (!mounted.current) return
      if (picked.status === 'canceled') return
      if (picked.status === 'denied' || picked.status === 'unavailable') {
        setPermissionIssue({ source, status: picked.status })
        return
      }
      if (picked.status !== 'selected') return
      setAvatarAsset(picked.asset)
    } catch (error) {
      if (mounted.current) setAvatarNotice(t(avatarErrorKey(error)))
    } finally {
      avatarLock.current = false
      if (mounted.current) setAvatarStep(null)
    }
  }

  async function confirmAvatar(value: AvatarAdjustment, viewport: number) {
    if (!avatarAsset || avatarLock.current || !canUpload) return
    avatarLock.current = true
    setAvatarNotice(null)
    setAvatarStep('uploading')
    try {
      const image = await cropAvatar(avatarAsset, value, viewport)
      if (!mounted.current) return
      const key = await upload.mutateAsync({ image, purpose: 'avatar' })
      if (!mounted.current) return
      await setAvatar.mutateAsync(key)
      if (!mounted.current) return
      haptic('success')
      track('profile_avatar_set')
      setAvatarAsset(null)
      AccessibilityInfo.announceForAccessibility(t('account.avatarSaved'))
    } catch (error) {
      if (mounted.current) setAvatarNotice(t(avatarErrorKey(error)))
    } finally {
      avatarLock.current = false
      if (mounted.current) setAvatarStep(null)
    }
  }

  async function removePicture() {
    if (avatarLock.current || !me.data?.avatarUrl) return
    avatarLock.current = true
    setAvatarNotice(null)
    setAvatarStep('removing')
    try {
      await removeAvatar.mutateAsync()
      if (!mounted.current) return
      haptic('success')
      track('profile_avatar_removed')
      setAvatarNotice(t('account.avatarRemoved'))
    } catch (error) {
      if (mounted.current) setAvatarNotice(t(avatarErrorKey(error)))
    } finally {
      avatarLock.current = false
      if (mounted.current) setAvatarStep(null)
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
    setDeleteConfirm(false)
    setBusy('delete')
    deleteAccount()
      .then(() => router.replace('/(tabs)'))
      .catch(() => setNotice(t('account.deleteFailed')))
      .finally(() => setBusy(null))
  }

  const header = (
    <View>
      <AppHeader showNotifications={false} variant="sub-screen" onBack={() => void goBack()} backDisabled={saving} title={t('account.title')}
        rightAction={canManage && me.data ? <AppHeaderAction accessibilityLabel={t('account.save')} onPress={() => void save()}
          disabled={!dirty || !valid || saving} accessibilityState={{ busy: saving }}>
          {saving ? <ActivityIndicator color={theme.accent.primary} /> : <Text variant="introSmall" color="redesign.primaryText">{t('account.save')}</Text>}
        </AppHeaderAction> : undefined} />
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

  if (avatarAsset) {
    return <AvatarEditor key={avatarAsset.uri} asset={avatarAsset} busy={avatarStep === 'uploading'} error={avatarNotice}
      onClose={() => { setAvatarAsset(null); setAvatarNotice(null) }}
      onChooseAnother={() => { setAvatarAsset(null); setAvatarNotice(null); setAvatarSheet(true) }}
      onConfirm={(value, viewport) => void confirmAvatar(value, viewport)} />
  }

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarBlock}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('account.avatarTitle')} style={styles.avatarPhoto} disabled={(!canUpload && !me.data?.avatarUrl) || avatarStep !== null} onPress={() => setAvatarSheet(true)}>
              <AvatarCircle label={initial} size={96} imageUri={me.data?.avatarUrl} />
              </Pressable>
              {avatarStep ? (
                <View style={styles.avatarOverlay} accessibilityElementsHidden>
                  <ActivityIndicator color={theme.accent.onAccent} />
                </View>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={t('account.avatarEdit')}
                accessibilityState={{ disabled: (!canUpload && !me.data?.avatarUrl) || avatarStep !== null, busy: avatarStep !== null }}
                disabled={(!canUpload && !me.data?.avatarUrl) || avatarStep !== null} onPress={() => setAvatarSheet(true)}
                style={({ pressed }) => [styles.avatarEdit, pressed && styles.pressed, ((!canUpload && !me.data?.avatarUrl) || avatarStep !== null) && styles.disabled]}>
                <View testID="avatar-edit-badge" style={styles.avatarEditBadge}><MaterialIcon name="edit" size={16} color="accent.onAccent" /></View>
              </Pressable>
            </View>

          </View>
          {!canUpload ? <Text style={styles.avatarCaption} variant="introSmall" color="status.warningText">{t('account.avatarUnavailable')}</Text> : null}
          {avatarNotice ? (
            <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite" style={styles.notice}>
              {avatarNotice}
            </Text>
          ) : null}
        </View>

        <Card appearance="stitch" padded={false} style={styles.card}>
          <View style={styles.cardHeader}><View style={styles.sectionMark} /><Text variant="savedWardTitle" accessibilityRole="header">{t('account.personalInfo')}</Text></View>
          <Text variant="introSmall">{t('auth.displayName')}</Text>
          <Controller control={form.control} name="name" render={({ field: { value, onChange, onBlur } }) => <TextInput
            value={value} onChangeText={onChange} onBlur={onBlur} maxLength={MAX_NAME} editable={!saving}
            placeholder={t('auth.displayNamePlaceholder')} placeholderTextColor={theme.text.secondary}
            autoCapitalize="words" accessibilityLabel={t('auth.displayName')} style={styles.input} />} />
          {form.formState.errors.name ? <Text variant="bodySmall" color="status.dangerText" accessibilityRole="alert" accessibilityLiveRegion="polite">{t(form.formState.errors.name.message as MessageKey)}</Text> : null}
          {me.data?.email ? <>
            <Text variant="introSmall">{t('account.email')}</Text>
            <View style={styles.emailRow} accessibilityLabel={t('account.emailReadOnly')}>
              <Text variant="introBody" color="text.secondary" selectable style={styles.emailValue}>{me.data.email}</Text>
              <MaterialIcon name="lock" size={16} color="text.secondary" />
              <Text variant="introCaption" color="text.secondary">{t('account.fixed')}</Text>
            </View>
          </> : null}


        {/* Keyed by account: a different sign-in never inherits the last one's typing. */}
        {me.data ? <DateOfBirthCard embedded profile={me.data} control={form.control} busy={saving}
          error={form.formState.errors.birthday?.message as MessageKey | undefined} onClear={() => form.setValue('birthday', '', { shouldValidate: true, shouldDirty: true })} /> : null}
        </Card>

        <Card appearance="stitch" padded={false} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.sectionMark, styles.neutralMark]} />
            <Text variant="savedWardTitle" accessibilityRole="header">{t('account.dataTitle')}</Text>
          </View>
          <Text variant="bodySmall" color="text.secondary">{t('account.exportBody')}</Text>
          <SecondaryBtn variant="neutral" leadingIcon="download"
            disabled={busy === 'export'} loading={busy === 'export'}
            label={busy === 'export' ? t('account.exporting') : t('account.export')}
            onPress={onExport}
          />
        </Card>

        <Card appearance="stitch" padded={false} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.sectionMark, styles.dangerMark]} />
            <Text variant="savedWardTitle" color="text.secondary" accessibilityRole="header">{t('account.deleteTitle')}</Text>
          </View>
          <Text variant="bodySmall" color="text.secondary">{t('account.deleteBody')}</Text>
          <Text variant="bodySmall" color="text.secondary">{t('account.deleteKept')}</Text>
          <Pressable
            onPress={() => setDeleteConfirm(true)}
            disabled={busy === 'delete'}
            accessibilityRole="button"
            accessibilityLabel={busy === 'delete' ? t('account.deleting') : t('account.deleteConfirm')}
            accessibilityState={{ disabled: busy === 'delete', busy: busy === 'delete' }}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed, busy === 'delete' && styles.disabled]}
          >
            <Icon name="trash" size={18} color="status.dangerText" />
            <Text variant="label" color="status.dangerText">
              {busy === 'delete' ? t('account.deleting') : t('account.deleteConfirm')}
            </Text>
          </Pressable>
        </Card>

        {notice ? (
          <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>
      <ResultSheet visible={deleteConfirm} variant="warning" title={t('account.deleteTitle')}
        body={t('account.deleteConfirmBody')} actionOrder="secondary-first"
        primaryAction={{ label: t('account.deleteAction'), destructive: true, onPress: onDelete }}
        secondaryAction={{ label: t('account.deleteCancel'), onPress: () => setDeleteConfirm(false) }} onClose={() => setDeleteConfirm(false)} />
      <AvatarSourceSheet visible={avatarSheet} hasPhoto={!!me.data?.avatarUrl} canUpload={canUpload}
        onClose={() => { pendingSource.current = null; setAvatarSheet(false) }} onClosed={sourceSheetClosed} onChoose={chooseAvatarSource} />
      <MediaPermissionSheet issue={permissionIssue}
        onSettings={() => { pendingSource.current = 'settings'; setPermissionIssue(null) }}
        onChoose={source => { pendingSource.current = source; setPermissionIssue(null) }}
        onClose={() => { pendingSource.current = null; setPermissionIssue(null) }} onClosed={sourceSheetClosed} />
      {dialog}
    </Atmosphere>
  )
}
