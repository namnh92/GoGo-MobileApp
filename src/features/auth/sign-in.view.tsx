import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import type { MessageKey } from '@/shared/i18n/types'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { classifyAuthFailure, type AuthFailureReason } from './auth-failure'
import { signInSchema, signUpSchema, type SignInValues, type SignUpValues } from './auth-schema'
import { postAuthRoute } from './post-auth-route'
import { styles } from './sign-in.style'

type Mode = 'signIn' | 'signUp'

export default function SignInScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signIn, signUp } = useSession()
  const { next } = useLocalSearchParams<{ next?: string }>()

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
  const pending = form.formState.isSubmitting

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
    // A literal lookup, so the i18n key scan reads every key this can ask for,
    // and `satisfies` makes tsc demand copy for every reason.
    setFormError(
      failure.serverMessage ??
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
    setMode(target)
    setFormError(null)
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing[5],
            paddingBottom: insets.bottom + spacing[6],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t(mode === 'signIn' ? 'auth.signInTitle' : 'auth.signUpTitle')}</Text>
          <Text style={styles.body}>{t(mode === 'signIn' ? 'auth.signInBody' : 'auth.signUpBody')}</Text>

          <View style={styles.tabs}>
            {(['signIn', 'signUp'] as const).map(option => {
              const active = mode === option
              return (
                <Pressable
                  key={option}
                  onPress={() => switchMode(option)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {t(option === 'signIn' ? 'auth.signInTab' : 'auth.signUpTab')}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <GlassCard style={styles.card}>
            {mode === 'signUp' ? (
              <Controller
                control={signUpForm.control}
                name="displayName"
                render={({ field, fieldState }) => (
                  <View style={styles.field}>
                    <Text style={styles.label}>{t('auth.displayName')}</Text>
                    <TextInput
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={t('auth.displayNamePlaceholder')}
                      placeholderTextColor={colors.neutral[500]}
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!pending}
                      maxLength={50}
                      accessibilityLabel={t('auth.displayName')}
                      style={[styles.input, fieldState.error && styles.inputInvalid]}
                    />
                    {fieldState.error ? <Text style={styles.fieldError}>{t('auth.displayNameInvalid')}</Text> : null}
                  </View>
                )}
              />
            ) : null}

            {/*
              #252: email and password are drawn for whichever form is active,
              so they must remount when the mode changes. react-hook-form 7.86
              subscribes a Controller's form state once and does not resubscribe
              when `control` changes; kept mounted, sign-up read sign-in's
              errors and an invalid sign-up submitted silently.
            */}
            <Controller
              key={`email-${mode}`}
              control={form.control as never}
              name="email"
              render={({ field, fieldState }) => (
                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.email')}</Text>
                  <TextInput
                    value={field.value as string}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.neutral[500]}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    autoCorrect={false}
                    editable={!pending}
                    accessibilityLabel={t('auth.email')}
                    style={[styles.input, fieldState.error && styles.inputInvalid]}
                  />
                  {fieldState.error ? <Text style={styles.fieldError}>{t('auth.emailInvalid')}</Text> : null}
                </View>
              )}
            />

            <Controller
              key={`password-${mode}`}
              control={form.control as never}
              name="password"
              render={({ field, fieldState }) => (
                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.password')}</Text>
                  <TextInput
                    value={field.value as string}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="••••••••••"
                    placeholderTextColor={colors.neutral[500]}
                    autoCapitalize="none"
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                    secureTextEntry
                    editable={!pending}
                    accessibilityLabel={t('auth.password')}
                    style={[styles.input, fieldState.error && styles.inputInvalid]}
                  />
                  {mode === 'signUp' ? <Text style={styles.hint}>{t('auth.passwordHint')}</Text> : null}
                  {fieldState.error ? <Text style={styles.fieldError}>{t('auth.passwordInvalid')}</Text> : null}
                </View>
              )}
            />
          </GlassCard>

          {formError ? (
            <Text accessibilityLiveRegion="polite" style={styles.formError}>
              {formError}
            </Text>
          ) : null}

          <View style={{ marginTop: 'auto', gap: spacing[3] }}>
            <PrimaryBtn
              label={t(mode === 'signIn' ? 'auth.signInCta' : 'auth.signUpCta')}
              onPress={mode === 'signIn' ? onSignIn : onSignUp}
              loading={pending}
            />
            <Text style={styles.footnote}>{t('auth.guestFootnote')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Atmosphere>
  )
}
