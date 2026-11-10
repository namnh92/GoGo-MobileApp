import { zodResolver } from '@hookform/resolvers/zod'
import type { NavigationProp } from '@react-navigation/native'
import { Redirect, useNavigation } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { completePasswordRecovery } from '@/shared/api/endpoints/password-recovery'
import { AppHeader } from '@/shared/ui/app-header.view'
import { PrimaryBtn } from '@/shared/ui/button.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { PasswordRequirements } from '@/shared/ui/password-requirements.view'
import { Atmosphere } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { ApiError } from '@/shared/api/errors'
import { recoveryPasswordSchema, type RecoveryPasswordValues } from './auth-schema'
import { maskRecoveryEmail, recoveryErrorKey, recoveryRetryAt, useRecoveryCountdown, useRecoveryFlow, useRecoveryMutation } from './password-recovery'
import { styles } from './password-recovery.style'

export default function ResetPasswordScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<NavigationProp<{ 'auth/sign-in': { next?: string } | undefined }>>()
  const insets = useSafeAreaInsets()
  const flow = useRecoveryFlow(state => state.flow)
  const complete = useRecoveryMutation(completePasswordRecovery)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  const expiresAt = Date.parse(flow?.expiresAt ?? '') || 0
  const remaining = useRecoveryCountdown(expiresAt)
  const blocked = useRecoveryCountdown(retryAt)
  const form = useForm<RecoveryPasswordValues>({ resolver: zodResolver(recoveryPasswordSchema), mode: 'onChange', defaultValues: { password: '', confirmPassword: '' } })
  const values = useWatch({ control: form.control })
  const validation = recoveryPasswordSchema.safeParse(values)
  const mismatch = !validation.success && validation.error.issues.some(issue => issue.message === 'passwordMismatch')
  const handingOff = useRef(false)
  useEffect(() => () => { if (!handingOff.current) useRecoveryFlow.getState().setFlow(null) }, [])
  const pending = complete.isPending || completed
  if (!flow?.code || !/^[0-9]{6}$/.test(flow.code)) return <Redirect href="/auth/forgot-password" />
  function submit() {
    if (!flow || pending || blocked || Date.now() >= expiresAt) return
    return form.handleSubmit(({ password }) => {
      const code = flow.code
      if (!code || !/^[0-9]{6}$/.test(code)) return
      complete.mutate({ email: flow.email, challengeId: flow.challengeId, code, password }, {
        onSuccess: () => {
          setCompleted(true)
          form.reset()
          complete.reset()
        },
        onError: error => {
          if (error instanceof ApiError && error.code === 'RECOVERY_INVALID') {
            returnToCode(true)
          } else setRetryAt(recoveryRetryAt(error))
        },
      })
    })()
  }
  function signIn() {
    navigation.reset({ index: 0, routes: [{ name: 'auth/sign-in', params: flow?.next ? { next: flow.next } : undefined }] })
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
          <Controller control={form.control} name="confirmPassword" render={({ field, fieldState }) => <LabelledInput
            ref={field.ref} label={t('auth.recovery.confirmPassword')} icon="lock" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
            autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={128} onSubmitEditing={submit}
            secureTextEntry={!showConfirmPassword} editable={!pending}
            error={mismatch && (fieldState.isTouched || (field.value.length > 0 && field.value.length === values.password?.length) || form.formState.submitCount > 0) ? t('auth.recovery.passwordMismatch') : undefined}
            trailing={<Pressable accessibilityRole="button" accessibilityLabel={t(showConfirmPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              disabled={pending} onPress={() => setShowConfirmPassword(shown => !shown)} style={styles.visibility}>
              <MaterialIcon name={showConfirmPassword ? 'eyeOff' : 'eye'} size={20} color="text.secondary" />
            </Pressable>} />} />
        </View>
        {complete.error && <Text color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>{t(recoveryErrorKey(complete.error))}</Text>}
        {remaining === 0 && <Pressable accessibilityRole="button" onPress={() => returnToCode()} style={styles.link}>
          <Text color="accent.primary">{t('auth.recovery.codeExpired')}</Text>
        </Pressable>}
        <View style={styles.actions}><PrimaryBtn label={t('auth.recovery.resetTitle')} onPress={submit} loading={complete.isPending} disabled={pending || !validation.success || blocked > 0 || remaining === 0} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
    <ResultSheet visible={completed} variant="success" title={t('auth.recovery.successTitle')} body={t('auth.recovery.successBody')}
      primaryAction={{ label: t('auth.signInCta'), onPress: signIn }} onClose={signIn} />
  </Atmosphere>
}
