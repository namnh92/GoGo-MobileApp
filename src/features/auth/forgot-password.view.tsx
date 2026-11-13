import { FormKeyboardAvoider } from '@/shared/ui/form-keyboard-avoider.view'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { verifyPasswordRecovery } from '@/shared/api/endpoints/password-recovery'
import { ApiError } from '@/shared/api/errors'
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
  const verify = useMutation({ mutationFn: verifyPasswordRecovery, retry: false, networkMode: 'always', gcTime: 0 })
  const verifying = useRef(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const pending = request.isPending || verify.isPending
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
  function enterCode(value: string[]) {
    if (!flow || handingOff.current || request.isPending || verifying.current) return
    setDigits(value)
    verify.reset()
    const code = value.join('')
    if (flow.invalidCode) useRecoveryFlow.getState().setFlow({ ...flow, invalidCode: false })
    if (/^[0-9]{6}$/.test(code) && Date.now() < expiresAt) {
      verifying.current = true
      verify.mutate({ email: flow.email, challengeId: flow.challengeId, code }, {
        onSuccess: () => {
          handingOff.current = true
          useRecoveryFlow.getState().setFlow({ ...flow, code, invalidCode: false })
          router.replace('/auth/reset-password')
        },
        onError: error => {
          if (error instanceof ApiError && error.status === 400 && error.code === 'RECOVERY_INVALID') {
            useRecoveryFlow.getState().setFlow({ ...flow, code: undefined, invalidCode: true })
            setDigits(Array(6).fill(''))
            setFocusRequest(value => value + 1)
          }
        },
        onSettled: () => { verifying.current = false },
      })
    }
  }
  function submit() {
    if (pending || recoveryRequestDeadline(email) > Date.now() || (flow && Date.now() < expiresAt)) return
    return form.handleSubmit(body => {
      request.mutate(body, {
        onSuccess: challenge => {
          verify.reset()
          useRecoveryFlow.getState().setFlow({ ...challenge, email: body.email, next: destination })
          setDigits(Array(6).fill(''))
        },
      })
    })()
  }
  return <Atmosphere redesign>
    <BlockingLoadingOverlay visible={pending} onClosed={() => {
      // iOS can restore keyboard focus only after the blocking modal dismisses.
      if (flow?.invalidCode) setFocusRequest(value => value + 1)
    }} />
    <AppHeader title={t('auth.recovery.forgotTitle')} centerTitle titleColor="accent.primary" showNotifications={false} onBack={back} backDisabled={pending} />
    <FormKeyboardAvoider style={styles.fill}>
      <View ref={viewportRef} testID="auth-viewport" style={styles.fill} onLayout={schedule}>
        <ScrollView ref={scrollRef} onLayout={schedule} onContentSizeChange={schedule} onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag}
          scrollEventThrottle={16} keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[4] }]} keyboardShouldPersistTaps="handled">
          <Text variant="introSection" style={styles.title}>{t('auth.recovery.forgotTitle')}</Text>
          <Text variant="introBody" color="text.secondary" style={styles.subtitle}>{flow ? t('auth.recovery.codeSent', { email: maskRecoveryEmail(flow.email) }) : t('auth.recovery.forgotBody')}</Text>
          {flow ? <View ref={node => fieldVisibility('code').groupRef(node)} testID="auth-field-code" onLayout={schedule} style={styles.form}>
            <View ref={node => fieldVisibility('code').controlRef(node)}>
              <RecoveryCode value={digits} onChange={enterCode} disabled={pending} focusRequest={focusRequest} onFocus={() => fieldVisibility('code').onFocus()} onBlur={() => fieldVisibility('code').onBlur()} />
            </View>
            {flow.invalidCode && <Text color="status.dangerText" accessibilityLiveRegion="polite">{t('auth.recovery.invalidCode')}</Text>}
            {verify.error && !flow.invalidCode && <Text color="status.dangerText" accessibilityLiveRegion="polite">{t(recoveryErrorKey(verify.error))}</Text>}
            {expiryRemaining === 0 && <Text color="status.dangerText" accessibilityLiveRegion="polite">{t('auth.recovery.codeExpired')}</Text>}
          </View> : <Controller control={form.control} name="email" render={({ field, fieldState }) => <LabelledInput
            {...fieldVisibility('email')} groupTestID="recovery-email-field" ref={field.ref} label={t('auth.email')} icon="mail" value={field.value} onChangeText={value => { request.reset(); field.onChange(value) }} onBlur={() => { field.onBlur(); fieldVisibility('email').onBlur() }} onSubmitEditing={submit}
            autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address"
            editable={!request.isPending} error={fieldState.error ? t('auth.emailInvalid') : accountNotFound ? t('auth.recovery.accountNotFound') : undefined} /> } />}
          {request.error && (!accountNotFound || flow) && <Text color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>{t(recoveryErrorKey(request.error))}</Text>}
          <View style={styles.actions}>
            <PrimaryBtn label={flow
              ? remaining > 0 ? t('auth.recovery.resendCountdown', { time: formatRecoveryCountdown(remaining) }) : t('auth.recovery.resend')
              : t('auth.recovery.sendCode')} onPress={submit} loading={request.isPending} disabled={pending || !validEmail || remaining > 0} />
          </View>
        </ScrollView>
      </View>
    </FormKeyboardAvoider>
  </Atmosphere>
}
