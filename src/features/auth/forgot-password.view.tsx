import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/shared/ui/app-header.view'
import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useFieldVisibility } from '@/shared/ui/use-field-visibility'
import { spacing } from '@/shared/ui/tokens'
import { PrimaryBtn } from '@/shared/ui/button.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { Atmosphere } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { recoveryEmailSchema } from './auth-schema'
import { formatRecoveryCountdown, maskRecoveryEmail, recoveryErrorKey, recoveryRequestDeadline, useRecoveryCountdown, useRecoveryRequestCountdown, useRecoveryFlow, useRecoveryRequest } from './password-recovery'
import { RecoveryCode } from './recovery-code.view'
import { styles } from './password-recovery.style'

export default function ForgotPasswordScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { next } = useLocalSearchParams<{ next?: string }>()
  const insets = useSafeAreaInsets()
  const initialNext = useRef(useRecoveryFlow.getState().flow?.next ?? next)
  const request = useRecoveryRequest()
  const flow = useRecoveryFlow(state => state.flow)
  const { scrollRef, viewportRef, schedule, onScroll, onScrollBeginDrag, field: fieldVisibility } = useFieldVisibility(flow ? 'code' : 'email')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const handingOff = useRef(false)
  useEffect(() => () => {
    if (!handingOff.current) useRecoveryFlow.getState().setFlow(null)
  }, [])
  const form = useForm<{ email: string }>({ resolver: zodResolver(recoveryEmailSchema), defaultValues: { email: flow?.email ?? '' }, mode: 'onTouched' })
  const email = useWatch({ control: form.control, name: 'email' })
  const validEmail = recoveryEmailSchema.safeParse({ email }).success
  const quotaRemaining = useRecoveryRequestCountdown(flow?.email ?? email)
  const expiresAt = Date.parse(flow?.expiresAt ?? '') || 0
  const expiryRemaining = useRecoveryCountdown(expiresAt)
  const remaining = Math.max(quotaRemaining, flow ? expiryRemaining : 0)
  const requestError = request.error ? recoveryErrorKey(request.error) : undefined
  const accountNotFound = requestError === 'auth.recovery.accountNotFound'
  const destination = flow?.next ?? initialNext.current
  const back = () => {
    useRecoveryFlow.getState().setFlow(null)
    router.replace({ pathname: '/auth/sign-in', params: destination ? { next: destination } : {} })
  }
  function changeEmail() {
    if (request.isPending) return
    useRecoveryFlow.getState().setFlow(null)
    setDigits(Array(6).fill(''))
    request.reset()
  }
  function enterCode(value: string[]) {
    setDigits(value)
    if (!flow || handingOff.current || request.isPending) return
    const code = value.join('')
    if (flow.invalidCode) useRecoveryFlow.getState().setFlow({ ...flow, invalidCode: false })
    if (/^[0-9]{6}$/.test(code) && Date.now() < expiresAt) {
      handingOff.current = true
      useRecoveryFlow.getState().setFlow({ ...flow, code, invalidCode: false })
      router.replace('/auth/reset-password')
    }
  }
  function submit() {
    if (request.isPending || recoveryRequestDeadline(email) > Date.now() || (flow && Date.now() < expiresAt)) return
    return form.handleSubmit(body => {
      request.mutate(body, {
        onSuccess: challenge => {
          useRecoveryFlow.getState().setFlow({ ...challenge, email: body.email, next: destination })
          setDigits(Array(6).fill(''))
        },
      })
    })()
  }
  return <Atmosphere redesign>
    <BlockingLoadingOverlay visible={request.isPending} />
    <AppHeader title={t('auth.recovery.forgotTitle')} centerTitle titleColor="accent.primary" showNotifications={false} onBack={back} backDisabled={request.isPending} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View ref={viewportRef} testID="auth-viewport" style={styles.fill} onLayout={schedule}>
        <ScrollView ref={scrollRef} onLayout={schedule} onContentSizeChange={schedule} onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag}
          scrollEventThrottle={16} keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[4] }]} keyboardShouldPersistTaps="handled">
          <Text variant="introSection" style={styles.title}>{t('auth.recovery.forgotTitle')}</Text>
          <Text variant="introBody" color="text.secondary" style={styles.subtitle}>{flow ? t('auth.recovery.codeSent', { email: maskRecoveryEmail(flow.email) }) : t('auth.recovery.forgotBody')}</Text>
          {flow ? <View ref={node => fieldVisibility('code').groupRef(node)} testID="auth-field-code" onLayout={schedule} style={styles.form}>
            <View ref={node => fieldVisibility('code').controlRef(node)}>
              <RecoveryCode value={digits} onChange={enterCode} disabled={request.isPending} onFocus={() => fieldVisibility('code').onFocus()} onBlur={() => fieldVisibility('code').onBlur()} />
            </View>
            {flow.invalidCode && <Text color="status.dangerText" accessibilityLiveRegion="polite">{t('auth.recovery.invalidCode')}</Text>}
            {expiryRemaining === 0 && <Text color="status.dangerText" accessibilityLiveRegion="polite">{t('auth.recovery.codeExpired')}</Text>}
            <Pressable accessibilityRole="button" disabled={request.isPending} accessibilityState={{ disabled: request.isPending }} onPress={changeEmail} style={styles.link}>
              <Text variant="introCaption" color="accent.primary">{t('auth.recovery.changeEmail')}</Text>
            </Pressable>
          </View> : <Controller control={form.control} name="email" render={({ field, fieldState }) => <LabelledInput
            {...fieldVisibility('email')} groupTestID="recovery-email-field" ref={field.ref} label={t('auth.email')} icon="mail" value={field.value} onChangeText={value => { request.reset(); field.onChange(value) }} onBlur={() => { field.onBlur(); fieldVisibility('email').onBlur() }} onSubmitEditing={submit}
            autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address"
            editable={!request.isPending} error={fieldState.error ? t('auth.emailInvalid') : accountNotFound ? t('auth.recovery.accountNotFound') : undefined} /> } />}
          {request.error && (!accountNotFound || flow) && <Text color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>{t(recoveryErrorKey(request.error))}</Text>}
          <View style={styles.actions}>
            <PrimaryBtn label={flow
              ? remaining > 0 ? t('auth.recovery.resendCountdown', { time: formatRecoveryCountdown(remaining) }) : t('auth.recovery.resend')
              : t('auth.recovery.sendCode')} onPress={submit} loading={request.isPending} disabled={!validEmail || remaining > 0} />
            {!flow && remaining > 0 && <Text color="text.secondary" style={styles.centered}>{t('auth.recovery.resendCountdown', { time: formatRecoveryCountdown(remaining) })}</Text>}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Atmosphere>
}
