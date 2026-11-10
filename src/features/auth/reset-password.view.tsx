import { zodResolver } from '@hookform/resolvers/zod'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { completePasswordRecovery } from '@/shared/api/endpoints/password-recovery'
import { AppHeader } from '@/shared/ui/app-header.view'
import { PrimaryBtn } from '@/shared/ui/button.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { PasswordRequirements } from '@/shared/ui/password-requirements.view'
import { Atmosphere } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { ApiError } from '@/shared/api/errors'
import { recoveryPasswordSchema } from './auth-schema'
import { maskRecoveryEmail, recoveryErrorKey, recoveryRetryAt, useRecoveryCountdown, useRecoveryFlow, useRecoveryMutation } from './password-recovery'
import { styles } from './password-recovery.style'

export default function ResetPasswordScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const flow = useRecoveryFlow(state => state.flow)
  const complete = useRecoveryMutation(completePasswordRecovery)
  const [showPassword, setShowPassword] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  const expiresAt = Date.parse(flow?.expiresAt ?? '') || 0
  const remaining = useRecoveryCountdown(expiresAt)
  const blocked = useRecoveryCountdown(retryAt)
  const form = useForm<{ password: string }>({ resolver: zodResolver(recoveryPasswordSchema), defaultValues: { password: '' } })
  const handingOff = useRef(false)
  useEffect(() => () => { if (!handingOff.current) useRecoveryFlow.getState().setFlow(null) }, [])
  const pending = complete.isPending
  if (!flow?.code || !/^[0-9]{6}$/.test(flow.code)) return <Redirect href="/auth/forgot-password" />
  function submit() {
    if (!flow || pending || blocked || Date.now() >= expiresAt) return
    return form.handleSubmit(({ password }) => {
      const code = flow.code
      if (!code || !/^[0-9]{6}$/.test(code)) return
      complete.mutate({ email: flow.email, challengeId: flow.challengeId, code, password }, {
        onSuccess: () => {
          // Remove the reset route before clearing its private navigation state.
          router.replace({ pathname: '/auth/sign-in', params: { recovered: '1', ...(flow.next ? { next: flow.next } : {}) } })
        },
        onError: error => {
          if (error instanceof ApiError && error.code === 'RECOVERY_INVALID') {
            returnToCode(true)
          } else setRetryAt(recoveryRetryAt(error))
        },
      })
    })()
  }
  function returnToCode(invalidCode = false) {
    if (!flow) return
    handingOff.current = true
    useRecoveryFlow.getState().setFlow({ ...flow, code: undefined, invalidCode })
  }
  return <Atmosphere redesign>
    <AppHeader title={t('auth.recovery.resetTitle')} centerTitle titleColor="accent.primary" showNotifications={false}
      onBack={() => returnToCode()} backDisabled={pending} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text variant="introSection" style={styles.title}>{t('auth.recovery.resetTitle')}</Text>
        <Text variant="introBody" color="text.secondary" style={styles.subtitle}>{t('auth.recovery.resetBody', { email: maskRecoveryEmail(flow.email) })}</Text>
        <View style={styles.form}>
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
        {complete.error && <Text color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>{t(recoveryErrorKey(complete.error))}</Text>}
        {remaining === 0 && <Pressable accessibilityRole="button" onPress={() => returnToCode()} style={styles.link}>
          <Text color="accent.primary">{t('auth.recovery.codeExpired')}</Text>
        </Pressable>}
        <View style={styles.actions}><PrimaryBtn label={t('auth.recovery.resetTitle')} onPress={submit} loading={complete.isPending} disabled={blocked > 0 || remaining === 0} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Atmosphere>
}
