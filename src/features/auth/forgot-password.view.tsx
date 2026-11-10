import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { requestPasswordRecovery } from '@/shared/api/endpoints/password-recovery'
import { AppHeader } from '@/shared/ui/app-header.view'
import { PrimaryBtn } from '@/shared/ui/button.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { Atmosphere } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { recoveryEmailSchema } from './auth-schema'
import { formatRecoveryCountdown, recoveryErrorKey, recoveryRetryAt, useRecoveryCountdown, useRecoveryFlow, useRecoveryMutation } from './password-recovery'
import { styles } from './password-recovery.style'

export default function ForgotPasswordScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { next } = useLocalSearchParams<{ next?: string }>()
  const insets = useSafeAreaInsets()
  const request = useRecoveryMutation(requestPasswordRecovery)
  const [retryAt, setRetryAt] = useState(0)
  const remaining = useRecoveryCountdown(retryAt)
  const form = useForm<{ email: string }>({ resolver: zodResolver(recoveryEmailSchema), defaultValues: { email: '' } })
  const back = () => router.replace({ pathname: '/auth/sign-in', params: next ? { next } : {} })
  const submit = form.handleSubmit(body => {
    if (request.isPending || remaining) return
    request.mutate(body, {
      onSuccess: challenge => {
        useRecoveryFlow.getState().setFlow({ ...challenge, email: body.email, next })
        router.push('/auth/reset-password')
      },
      onError: error => setRetryAt(recoveryRetryAt(error)),
    })
  })
  return <Atmosphere redesign>
    <AppHeader title={t('auth.recovery.forgotTitle')} centerTitle titleColor="accent.primary" showNotifications={false} onBack={back} backDisabled={request.isPending} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text variant="introSection" style={styles.title}>{t('auth.recovery.forgotTitle')}</Text>
        <Text variant="introBody" color="text.secondary" style={styles.subtitle}>{t('auth.recovery.forgotBody')}</Text>
        <Controller control={form.control} name="email" render={({ field, fieldState }) => <LabelledInput
          ref={field.ref} label={t('auth.email')} icon="mail" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          placeholder={t('auth.emailPlaceholder')} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address"
          editable={!request.isPending} error={fieldState.error ? t('auth.emailInvalid') : undefined} /> } />
        {request.error && <Text color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>{t(recoveryErrorKey(request.error))}</Text>}
        <View style={styles.actions}>
          <PrimaryBtn label={t('auth.recovery.sendCode')} onPress={submit} loading={request.isPending} disabled={remaining > 0} />
          {remaining > 0 && <Text color="text.secondary" style={styles.centered}>{t('auth.recovery.resendCountdown', { time: formatRecoveryCountdown(remaining) })}</Text>}
          <Text variant="introCaption" color="text.secondary" style={styles.centered}>{t('auth.recovery.expiry')}</Text>
          <Pressable accessibilityRole="link" disabled={request.isPending} accessibilityState={{ disabled: request.isPending }} onPress={back} style={styles.link}>
            <Text color="accent.primary" style={styles.linkText}>{t('auth.recovery.backToSignIn')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Atmosphere>
}
