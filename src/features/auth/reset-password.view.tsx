import { zodResolver } from '@hookform/resolvers/zod'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { completePasswordRecovery, requestPasswordRecovery } from '@/shared/api/endpoints/password-recovery'
import { AppHeader } from '@/shared/ui/app-header.view'
import { GhostBtn, PrimaryBtn } from '@/shared/ui/button.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { PasswordRequirements } from '@/shared/ui/password-requirements.view'
import { Atmosphere } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { recoveryPasswordSchema } from './auth-schema'
import { formatRecoveryCountdown, maskRecoveryEmail, recoveryErrorKey, recoveryRetryAt, useRecoveryCountdown, useRecoveryFlow, useRecoveryMutation } from './password-recovery'
import { RecoveryCode } from './recovery-code.view'
import { styles } from './password-recovery.style'

export default function ResetPasswordScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const flow = useRecoveryFlow(state => state.flow)
  const request = useRecoveryMutation(requestPasswordRecovery)
  const complete = useRecoveryMutation(completePasswordRecovery)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [showPassword, setShowPassword] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  const [codeError, setCodeError] = useState(false)
  const remaining = useRecoveryCountdown(Math.max(Date.parse(flow?.resendAvailableAt ?? '') || 0, retryAt))
  const blocked = useRecoveryCountdown(retryAt)
  const form = useForm<{ password: string }>({ resolver: zodResolver(recoveryPasswordSchema), defaultValues: { password: '' } })
  useEffect(() => () => { useRecoveryFlow.getState().setFlow(null) }, [])
  const pending = request.isPending || complete.isPending
  if (!flow) return <Redirect href="/auth/forgot-password" />
  const error = complete.error ?? request.error
  const submit = form.handleSubmit(({ password }) => {
    if (pending || blocked) return
    const code = digits.join('')
    if (!/^[0-9]{6}$/.test(code)) { setCodeError(true); return }
    request.reset()
    complete.mutate({ email: flow.email, challengeId: flow.challengeId, code, password }, {
      onSuccess: () => {
        // Remove the reset route before clearing its private navigation state.
        router.replace({ pathname: '/auth/sign-in', params: { recovered: '1', ...(flow.next ? { next: flow.next } : {}) } })
      },
      onError: error => setRetryAt(recoveryRetryAt(error)),
    })
  })
  function resend() {
    if (pending || remaining || !flow) return
    complete.reset()
    request.mutate({ email: flow.email }, {
      onSuccess: challenge => {
        useRecoveryFlow.getState().setFlow({ ...flow, ...challenge })
        setDigits(Array(6).fill(''))
        setCodeError(false)
      },
      onError: error => setRetryAt(recoveryRetryAt(error)),
    })
  }
  return <Atmosphere redesign>
    <AppHeader title={t('auth.recovery.resetTitle')} centerTitle titleColor="accent.primary" showNotifications={false}
      onBack={() => router.replace({ pathname: '/auth/forgot-password', params: flow.next ? { next: flow.next } : {} })} backDisabled={pending} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text variant="introSection" style={styles.title}>{t('auth.recovery.resetTitle')}</Text>
        <Text variant="introBody" color="text.secondary" style={styles.subtitle}>{t('auth.recovery.resetBody', { email: maskRecoveryEmail(flow.email) })}</Text>
        <View style={styles.form}>
          <RecoveryCode value={digits} onChange={value => { setDigits(value); setCodeError(false) }} disabled={pending} />
          {codeError && <Text color="status.dangerText" accessibilityLiveRegion="polite">{t('auth.recovery.codeRequired')}</Text>}
          {remaining > 0 ? <Text variant="introCaption" color="text.secondary">{t('auth.recovery.resendCountdown', { time: formatRecoveryCountdown(remaining) })}</Text>
            : <GhostBtn label={t('auth.recovery.resend')} onPress={resend} loading={request.isPending} disabled={pending} />}
          <Controller control={form.control} name="password" render={({ field, fieldState }) => <>
            <LabelledInput ref={field.ref} label={t('auth.recovery.newPassword')} icon="lock" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
              placeholder={t('auth.recovery.passwordPlaceholder')} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={128}
              secureTextEntry={!showPassword} editable={!pending} error={fieldState.error ? t('auth.passwordInvalid') : undefined}
              trailing={<Pressable accessibilityRole="button" accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                disabled={pending} onPress={() => setShowPassword(shown => !shown)} style={styles.visibility}>
                <MaterialIcon name={showPassword ? 'eyeOff' : 'eye'} size={20} color="text.secondary" />
              </Pressable>} />
            <View style={styles.requirements}><PasswordRequirements value={field.value} /></View>
          </>} />
        </View>
        {error && <Text color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>{t(recoveryErrorKey(error))}</Text>}
        <View style={styles.actions}><PrimaryBtn label={t('auth.recovery.resetTitle')} onPress={submit} loading={complete.isPending} disabled={request.isPending || blocked > 0} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Atmosphere>
}
