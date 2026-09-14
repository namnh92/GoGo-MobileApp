import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Text, TextInput, View } from 'react-native'
import { z } from 'zod'

import { isApiError, isOffline, useUpdateDateOfBirth, type Me } from '@/shared/api'
import { track } from '@/shared/analytics'
import { haptic } from '@/shared/ui/feedback'
import { GhostBtn, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { colors } from '@/shared/ui/tokens'

import { checkTypedDateOfBirth, formatDateOfBirth, isoToTyped } from './date-of-birth'
import { styles } from './date-of-birth.style'

type Reason = 'invalid' | 'future'

/** The server's two rules, checked before a request is spent on them. */
const schema = z.object({ text: z.string() }).superRefine((value, ctx) => {
  const check = checkTypedDateOfBirth(value.text)
  if (!check.ok) ctx.addIssue({ code: 'custom', path: ['text'], message: check.reason })
})

/** Which rule a refused save broke, when the server names one (PROF-BE-013). */
function serverReason(error: unknown): Reason | null {
  if (!isApiError(error)) return null
  const field = error.fieldErrors.find(entry => entry.field === 'dateOfBirth')
  if (!field) return null
  return (field as { code?: unknown }).code === 'too_big' ? 'future' : 'invalid'
}

/**
 * PROF-APP-006 (#217) — optional date of birth in account information. Typed
 * as day/month/year, the one date input pattern the app has; no picker library
 * is installed and a native one would need an ADR. The saved value is shown in
 * the reader's language, read from its own calendar parts, so no time zone can
 * move it. Only the owner's profile carries it: the parent keys this card by
 * account id, so a different sign-in starts from that account's value.
 */
export function DateOfBirthCard({ profile }: { profile: Me }) {
  const { t, i18n } = useTranslation()
  const update = useUpdateDateOfBirth()
  const saved = profile.dateOfBirth ?? null

  const form = useForm({ resolver: zodResolver(schema), defaultValues: { text: isoToTyped(saved) } })
  const text = useWatch({ control: form.control, name: 'text' })
  const [serverError, setServerError] = useState<Reason | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [action, setAction] = useState<'save' | 'clear' | null>(null)

  const label = formatDateOfBirth(saved, i18n.language)
  const reason = (form.formState.errors.text?.message as Reason | undefined) ?? serverError
  const busy = action !== null

  // A second press that lands before the re-render disabling the buttons (a fast
  // double tap) must not send a second request; state updates are too late.
  const inFlight = useRef(false)

  async function commit(next: string | null) {
    if (inFlight.current) return
    inFlight.current = true
    setNotice(null)
    setServerError(null)
    setAction(next === null ? 'clear' : 'save')
    try {
      await update.mutateAsync(next)
      form.reset({ text: isoToTyped(next) })
      haptic('success')
      track(next === null ? 'profile_date_of_birth_cleared' : 'profile_date_of_birth_saved')
      setNotice(t(next === null ? 'account.dobCleared' : 'account.dobSaved'))
    } catch (error) {
      // The cache is already rolled back by the hook; the typed text stays so
      // a retry is one press.
      const refused = serverReason(error)
      if (refused) setServerError(refused)
      else setNotice(t(isOffline(error) ? 'common.offlineBody' : 'account.dobFailed'))
    } finally {
      inFlight.current = false
      setAction(null)
    }
  }

  function submit(values: z.infer<typeof schema>) {
    const check = checkTypedDateOfBirth(values.text)
    if (check.ok) return commit(check.iso)
  }

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('account.dobTitle')}
        </Text>
        <Text style={styles.sectionBody}>{t('account.dobBody')}</Text>
      </View>

      <Text style={label ? styles.value : styles.unset}>
        {label ? t('account.dobCurrent', { date: label }) : t('account.dobUnset')}
      </Text>

      <Controller
        control={form.control}
        name="text"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            accessibilityLabel={t('account.dobInputLabel')}
            accessibilityHint={t('account.dobFormat')}
            value={value}
            onChangeText={next => {
              setServerError(null)
              onChange(next)
            }}
            onBlur={onBlur}
            placeholder={t('account.dobPlaceholder')}
            placeholderTextColor={colors.neutral[500]}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            autoCorrect={false}
            editable={!busy}
            style={styles.input}
          />
        )}
      />
      <Text style={styles.hint}>{t('account.dobFormat')}</Text>
      {reason ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.problem}>
          {t(reason === 'future' ? 'account.dobFuture' : 'account.dobInvalid')}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <SecondaryBtn
          label={t('account.dobSave')}
          onPress={() => void form.handleSubmit(submit)()}
          disabled={!form.formState.isDirty || !text?.trim() || busy}
          loading={action === 'save'}
          style={styles.saveBtn}
        />
        {saved ? <GhostBtn label={t('account.dobClear')} onPress={() => void commit(null)} disabled={busy} /> : null}
      </View>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </GlassCard>
  )
}
