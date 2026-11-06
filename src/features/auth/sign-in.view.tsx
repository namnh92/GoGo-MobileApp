import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import type { MessageKey } from '@/shared/i18n/types'
import { Atmosphere, AvatarCircle, BackHeader, PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { Badge } from '@/shared/ui/badge.view'
import { InfoBanner } from '@/shared/ui/info-banner.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { PasswordRequirements } from '@/shared/ui/password-requirements.view'
import { SegmentedControl } from '@/shared/ui/segmented-control.view'
import { UnavailableAction } from '@/shared/ui/unavailable-action.view'

import { classifyAuthFailure, type AuthFailureReason } from './auth-failure'
import { signInSchema, signUpSchema, type SignInValues, type SignUpValues } from './auth-schema'
import { postAuthRoute } from './post-auth-route'
import { styles } from './sign-in.style'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

type Mode = 'signIn' | 'signUp'

/** The fields each form draws, so a server field error can find its input. */
const SIGN_IN_FIELDS = ['email', 'password'] as const satisfies readonly (keyof SignInValues)[]
const SIGN_UP_FIELDS = ['displayName', 'email', 'password'] as const satisfies readonly (keyof SignUpValues)[]

/**
 * #273: put each server field error on the input it names. Returns the fields
 * attached, in server order, and whether any error had no input on this form —
 * that one still needs the generic line.
 */
function attachFieldErrors<T extends SignInValues | SignUpValues>(
  form: UseFormReturn<T>,
  known: readonly string[],
  fields: readonly string[],
): { attached: string[]; unattached: boolean } {
  const attached = fields.filter(field => known.includes(field))
  attached.forEach(field => {
    // The message is never drawn — each field renders its own i18n copy. No
    // `shouldFocus`: this runs mid-submit, when every input is disabled (F-04).
    form.setError(field as Parameters<typeof form.setError>[0], { type: 'server' })
  })
  return { attached, unattached: attached.length < fields.length }
}

export default function SignInScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signIn, signUp } = useSession()
  const { next } = useLocalSearchParams<{ next?: string }>()

  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<Mode>('signIn')
  const [formError, setFormError] = useState<string | null>(null)

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  })

  const form = mode === 'signIn' ? signInForm : signUpForm
  // #274: either form in flight locks the whole screen, tabs included. Reading
  // only the visible form let a pending sign-in be hidden behind the sign-up
  // tab, whose failure then landed under the wrong form.
  const pending = signInForm.formState.isSubmitting || signUpForm.formState.isSubmitting

  /**
   * #310 F-04: the first field a server rejected, focused once the submit has
   * settled. Focusing inside the submit did nothing on a device: every input is
   * `editable={false}` while pending, and a disabled native view takes no focus.
   */
  const [focusRequest, setFocusRequest] = useState<{ id: number; form: Mode; field: keyof SignUpValues } | null>(null)
  const focusHandled = useRef(0)
  useEffect(() => {
    if (pending || !focusRequest || focusHandled.current === focusRequest.id) return
    focusHandled.current = focusRequest.id
    if (focusRequest.form === 'signIn') {
      if (focusRequest.field !== 'displayName') signInForm.setFocus(focusRequest.field)
    } else {
      signUpForm.setFocus(focusRequest.field)
    }
  }, [pending, focusRequest, signInForm, signUpForm])

  /**
   * Where to land after authenticating, decided by an explicit `next` rather
   * than by history. `router.back()` sent someone who arrived from a deep link
   * or from onboarding straight back to the intro carousel right after they
   * created an account.
   */
  function done() {
    // `create` returns to the wizard's last step so the draft is not lost.
    router.replace(postAuthRoute(next))
  }

  /** #252: say which kind of failure it was, and record why without PII. */
  function reportFailure(event: 'auth_sign_in_failed' | 'auth_register_failed', error: unknown) {
    const failure = classifyAuthFailure(error)
    track(event, failure.telemetry)
    if (failure.fields?.length) {
      const signingIn = event === 'auth_sign_in_failed'
      const { attached, unattached } = signingIn
        ? attachFieldErrors(signInForm, SIGN_IN_FIELDS, failure.fields)
        : attachFieldErrors(signUpForm, SIGN_UP_FIELDS, failure.fields)
      const first = attached[0] as keyof SignUpValues | undefined
      if (first) {
        setFocusRequest(previous => ({ id: (previous?.id ?? 0) + 1, form: signingIn ? 'signIn' : 'signUp', field: first }))
        // #310 F-01: a field error is new text with no live region, and with no
        // generic line nothing else would be spoken. Say the first one.
        const copy = first === 'password' && signingIn ? 'signInPassword' : first
        AccessibilityInfo.announceForAccessibility(
          t(
            ({
              displayName: 'auth.displayNameInvalid',
              email: 'auth.emailInvalid',
              password: 'auth.passwordInvalid',
              signInPassword: 'auth.signInPasswordInvalid',
            } as const satisfies Record<keyof SignUpValues | 'signInPassword', MessageKey>)[copy],
          ),
        )
      }
      if (!unattached) return
    }
    // A literal lookup, so the i18n key scan reads every key this can ask for,
    // and `satisfies` makes tsc demand copy for every reason.
    setFormError(
      t(
        ({
          timeout: 'auth.timeoutError',
          offline: 'auth.networkError',
          invalid_credentials: 'auth.invalidCredentials',
          conflict: 'auth.registerConflict',
          rate_limited: 'auth.rateLimited',
          field_invalid: 'auth.genericError',
          rejected: 'auth.genericError',
          server: 'auth.genericError',
          unexpected: 'auth.unexpectedError',
        } as const satisfies Record<AuthFailureReason, MessageKey>)[failure.reason],
      ),
    )
  }

  const onSignIn = signInForm.handleSubmit(async values => {
    setFormError(null)
    try {
      await signIn(values)
      track('auth_signed_in')
      done()
    } catch (error) {
      reportFailure('auth_sign_in_failed', error)
    }
  })

  const onSignUp = signUpForm.handleSubmit(async values => {
    setFormError(null)
    try {
      await signUp(values)
      track('auth_registered')
      done()
    } catch (error) {
      reportFailure('auth_register_failed', error)
    }
  })

  function switchMode(target: Mode) {
    if (pending) return
    setMode(target)
    setFormError(null)
  }

  return (
    <Atmosphere redesign>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader redesign title={t(mode === 'signIn' ? 'auth.signInTab' : 'auth.signUpTab')} onBack={() => goBackOrHome(router)}
          right={<AvatarCircle label="" size={32} icon="user" />} />
      </View>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.tabs}>
            <SegmentedControl<Mode> value={mode} disabled={pending} onChange={switchMode} options={[
              { value: 'signIn', label: t('auth.signInTab') }, { value: 'signUp', label: t('auth.signUpTab') },
            ]} />
          </View>
          <View style={styles.editorial}>
            <Badge appearance="stitchViolet" icon="room" label={t('auth.hostBadge')} style={styles.hostBadge} />
            <Text variant="introSection" color="redesign.ink" style={styles.title}>{t(mode === 'signUp' ? 'auth.signUpTitle' : next === 'assistant' ? 'auth.signInTitleAssistant' : 'auth.signInTitle')}</Text>
            <Text variant="introBody" color="redesign.secondary">{t(mode === 'signIn' ? 'auth.signInBody' : 'auth.signUpBody')}</Text>
          </View>
          <View style={styles.coffee}><InfoBanner coffee title={t('auth.coffeeTitle')} body={t('auth.coffeeBody')} /></View>
          <View style={styles.form}>
            {mode === 'signUp' && <Controller control={signUpForm.control} name="displayName" render={({ field, fieldState }) => (
              <LabelledInput label={t('auth.displayName')} icon="badge" ref={field.ref} value={field.value}
                onChangeText={field.onChange} onBlur={field.onBlur} placeholder={t('auth.displayNamePlaceholder')}
                autoCapitalize="words" autoCorrect={false} editable={!pending} maxLength={50}
                error={fieldState.error ? t('auth.displayNameInvalid') : undefined} />
            )} />}
            <Controller key={`email-${mode}`} control={form.control as never} name="email" render={({ field, fieldState }) => (
              <LabelledInput label={t('auth.email')} icon="mail" ref={field.ref} value={field.value as string}
                onChangeText={field.onChange} onBlur={field.onBlur} placeholder={t('auth.emailPlaceholder')}
                autoCapitalize="none" autoComplete="email" keyboardType="email-address" autoCorrect={false}
                editable={!pending} error={fieldState.error ? t('auth.emailInvalid') : undefined} />
            )} />
            <Controller key={`password-${mode}`} control={form.control as never} name="password" render={({ field, fieldState }) => (
              <LabelledInput label={t('auth.password')} icon="lock" ref={field.ref} value={field.value as string}
                onChangeText={field.onChange} onBlur={field.onBlur} placeholder={t('auth.passwordPlaceholder')}
                autoCapitalize="none" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                secureTextEntry={!showPassword} editable={!pending}
                accessory={mode === 'signIn' ? <UnavailableAction label={t('auth.forgot')} reason={t('auth.recoveryUnavailable')} /> : undefined}
                trailing={<Pressable testID="password-visibility" onPress={() => setShowPassword(shown => !shown)}
                  accessibilityRole="button" accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                  hitSlop={6} style={styles.visibility}>
                  <MaterialIcon name={showPassword ? 'eyeOff' : 'eye'} size={20} color="redesign.outline" />
                </Pressable>}
                error={fieldState.error ? t(mode === 'signIn' ? 'auth.signInPasswordInvalid' : 'auth.passwordInvalid') : undefined}>
                {mode === 'signUp' && <PasswordRequirements value={field.value as string} />}
              </LabelledInput>
            )} />
          </View>
          {formError && <Text variant="introSmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.formError}>{formError}</Text>}
          <View style={styles.actions}>
            <PrimaryBtn variant="stitchSubtle" label={t(mode === 'signIn' ? 'auth.signInCta' : 'auth.signUpCta')}
              onPress={mode === 'signIn' ? onSignIn : onSignUp} icon="arrowRight" loading={pending} />
          </View>
          <View style={styles.note}><InfoBanner body={t('auth.guestFootnote')} footerLeft={t('auth.support')} footerRight={t('auth.curation')} /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Atmosphere>
  )
}
