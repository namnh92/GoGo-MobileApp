import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TouchableWithoutFeedback, View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { isApiError, usePlaceSubmission, useResolveGoogleMapsLink, useSubmitPlace, useTaxonomies, type ResolveLinkResult } from '@/shared/api'
import { track } from '@/shared/analytics'
import { Icon } from '@/shared/ui/icons'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { openWebsite } from '@/shared/navigation/external-links'
import { useSession } from '@/shared/providers/session-provider'
import { ImportPhotos } from './import-photos.view'
import { FieldFocusGroup, FocusedFieldGroup } from '@/shared/ui/field-focus-group'
import { ExistingPlaceResult } from './existing-place-result.view'
import { Atmosphere, BackHeader, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import * as Clipboard from 'expo-clipboard'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { styles } from './import.style'

// Accepted Google Maps link shapes (SRS FR-PLACE-001). The server validates
// again — this only keeps an obviously wrong paste from costing a round trip.
const mapsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => {
    try {
      const parsed = new URL(value)
      const host = parsed.hostname.replace(/^www\./, '')
      return (
        host === 'maps.google.com' ||
        host === 'maps.app.goo.gl' ||
        host === 'goo.gl' ||
        (host === 'google.com' && parsed.pathname.startsWith('/maps')) ||
        host.endsWith('.google.com')
      )
    } catch {
      return false
    }
  })

type Candidate = NonNullable<ResolveLinkResult['candidate']>

const MAX_NOTE = 1000
const MAX_VIBES = 3

/**
 * APP-036 — GoGo cannot reach its place provider (GoGo-BE#279).
 *
 * Worth its own branch because the wrong copy here is not a wording slip: the
 * screen's other failure states all say something about the link the user
 * pasted, and this one is about us. Until the BFF grew this code, a disabled
 * Google API arrived as `UNRESOLVED / NOT_FOUND` and the app told people a real
 * café did not exist.
 *
 * Falls back to the status so the branch still works against a deployment that
 * answers 503 with a different code.
 */
function providerUnavailable(error: unknown): boolean {
  if (!isApiError(error)) return false
  return error.code === 'PLACE_PROVIDER_UNAVAILABLE' || error.status === 503
}

/**
 * APP-042 — the resolve proof went stale between preview and submit
 * (GoGo-BE#337).
 *
 * The server refuses it rather than quietly verifying the place with Google a
 * second time, which is the whole point: the cost has to be visible. The user
 * did nothing wrong — they read the preview and took a minute — so the screen
 * resolves the same link again itself instead of asking anyone to re-paste it.
 * Exactly once: a loop here would turn one stale token into an unbounded run of
 * paid resolves.
 */
/**
 * #131 — Google lists the place as opening soon (GoGo-BE#339). The preview can
 * say operating and the submit still meet this, when Google changed its mind
 * in between; it is a fact about the place, not a failure to retry.
 */
function notYetOpen(error: unknown): boolean {
  return isApiError(error) && error.code === 'PLACE_NOT_YET_OPEN'
}

function staleResolution(error: unknown): boolean {
  return isApiError(error) && error.code === 'RESOLUTION_TOKEN_INVALID'
}
/** Price inputs are typed in thousands of dong; the API wants minor units. */
const PRICE_MULTIPLIER = 1000

export default function PlaceImportScreen() {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status: actorStatus } = useSession()
  const { roomId } = useLocalSearchParams<{ roomId?: string }>()

  const focusedGroup = useRef<View>(null)
  const scrollRef = useRef<ScrollView>(null)
  const contentRef = useRef<View>(null)
  const scrollY = useRef(0)
  const viewportHeight = useRef(0)
  const revealFocused = useCallback(() => {
    requestAnimationFrame(() => {
      const target = focusedGroup.current
      const content = contentRef.current
      if (!target || !content) return
      target.measureLayout(
        content,
        (_x, y, _width, height) => {
          const bottom = y + height + spacing[4]
          if (bottom > scrollY.current + viewportHeight.current) {
            scrollRef.current?.scrollTo({ y: bottom - viewportHeight.current, animated: false })
          } else if (y < scrollY.current) {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing[4]), animated: false })
          }
        },
        () => {},
      )
    })
  }, [])
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', revealFocused)
    return () => subscription.remove()
  }, [revealFocused])

  const [url, setUrl] = useState('')
  const currentUrl = useRef('')
  const attemptGeneration = useRef(0)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [linkFailed, setLinkFailed] = useState(false)
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState<string | null>(null)
  // True only during the silent re-resolve of a stale attestation, so the CTA
  // keeps its loading state across the two requests instead of flickering back
  // to idle between them (APP-042).
  const submitLock = useRef(false)
  const [revalidating, setRevalidating] = useState(false)

  // Optional metadata (PI-APP-004) — everything here may be left blank.
  const [category, setCategory] = useState<string | null>(null)
  const [vibes, setVibes] = useState<string[]>([])
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  const taxonomies = useTaxonomies({ kinds: 'category,mood' })
  const resolve = useResolveGoogleMapsLink()
  const submit = useSubmitPlace()
  // A proposal is queued for moderation, so its status is polled after sending.
  const submission = usePlaceSubmission(submit.data?.status === 'ALREADY_EXISTS' ? undefined : submit.data?.submissionId)

  function taxonomyOptions(kind: string) {
    return (taxonomies.data?.kinds?.[kind] ?? []).map((entry) => ({
      key: entry.key ?? '',
      label: entry.labels?.[i18n.language] ?? entry.labels?.vi ?? entry.key ?? '',
    }))
  }

  function toggleVibe(key: string) {
    setVibes((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key)
      return prev.length < MAX_VIBES ? [...prev, key] : prev
    })
  }

  /** Only sends what the user actually filled in. */
  function metadata() {
    const min = Number(priceMin.replace(',', '.'))
    const max = Number(priceMax.replace(',', '.'))
    const hasMin = Number.isFinite(min) && min > 0
    const hasMax = Number.isFinite(max) && max > 0
    return {
      ...(category ? { category } : {}),
      ...(vibes.length > 0 ? { vibes } : {}),
      ...(hasMin || hasMax
        ? {
            estimatedPrice: {
              ...(hasMin ? { min: Math.round(min * PRICE_MULTIPLIER) } : {}),
              ...(hasMax ? { max: Math.round(max * PRICE_MULTIPLIER) } : {}),
              unit: 'per_person' as const,
            },
          }
        : {}),
      ...(note.trim() ? { note: note.trim().slice(0, MAX_NOTE) } : {}),
    }
  }

  const previewMatchesUrl = resolvedUrl !== null && resolvedUrl === url.trim()
  const result = previewMatchesUrl ? resolve.data : undefined
  const candidate = result?.candidate as Candidate | undefined
  // #131: Google lists it as opening soon; the server refuses the submit.
  const notOpenYet = candidate?.businessStatus === 'FUTURE_OPENING'

  function invalidateAttempt() {
    attemptGeneration.current += 1
    submitLock.current = false
    setRevalidating(false)
  }

  function onResolve() {
    const parsed = mapsUrlSchema.safeParse(url)
    if (!parsed.success) {
      setInvalid(true)
      return
    }
    invalidateAttempt()
    const generation = attemptGeneration.current
    setInvalid(false)
    setResolvedUrl(parsed.data)
    setSelectedGooglePlaceId(null)
    submit.reset()
    track('place_import_submitted')

    resolve.mutate(
      { url: parsed.data, ...(roomId ? { roomId } : {}) },
      {
        onSuccess: (resolved) => {
          if (generation !== attemptGeneration.current) return
          if (resolved.status === 'RESOLVED') track('place_import_verified', { placeId: resolved.candidate?.googlePlaceId ?? '' })
          else track('place_import_rejected', { reason: resolved.status ?? 'UNRESOLVED' })
        },
      },
    )
  }

  /**
   * The `resolutionToken` from the preview rides along, so the server does not
   * verify the same place with Google twice (GoGo-BE#337 / plan §2.8). It is
   * opaque, lives only in this screen's query state, and is never persisted,
   * logged or sent to analytics — `track` below carries the place id, which is
   * the only part of this exchange that means anything to a human.
   *
   * A client that sends nothing still works; the server just pays for the extra
   * fetch, which is the rollback.
   */
  // One reading of a submit refusal, shown beside whichever CTA sent it (#316 F-01).
  const submitError = submit.isError ? t(notYetOpen(submit.error) ? 'placeImport.notYetOpen' : 'placeImport.submitFailed') : null

  async function onSubmitPlace(googlePlaceId: string, token?: string, retried = false, generation = attemptGeneration.current) {
    if (
      generation !== attemptGeneration.current ||
      !previewMatchesUrl ||
      currentUrl.current.trim() !== resolvedUrl ||
      submit.isSuccess ||
      submit.isPending ||
      (submitLock.current && !retried)
    )
      return
    submitLock.current = true
    const resolutionToken = token ?? resolve.data?.resolutionToken
    try {
      const submission = await submit.mutateAsync({
        googlePlaceId,
        ...(resolutionToken ? { resolutionToken } : {}),
        ...(roomId ? { roomId } : {}),
        ...metadata(),
      })
      if (generation !== attemptGeneration.current) return
      track('place_import_added', { placeId: submission.placeId ?? googlePlaceId })
    } catch (error) {
      if (generation !== attemptGeneration.current || retried || !staleResolution(error)) return
      await revalidateAndResubmit(googlePlaceId, generation)
    } finally {
      if (generation === attemptGeneration.current) submitLock.current = false
    }
  }

  /** One silent re-resolve, then one retry — never a loop. */
  async function revalidateAndResubmit(googlePlaceId: string, generation: number) {
    const verifiedUrl = resolvedUrl
    if (generation !== attemptGeneration.current || !verifiedUrl || currentUrl.current.trim() !== verifiedUrl) return
    const parsed = mapsUrlSchema.safeParse(verifiedUrl)
    if (!parsed.success) return
    setRevalidating(true)
    // The stale-token refusal is spent; if the re-resolve comes back with a new
    // answer (several candidates), it must not open beside that old error (#316 F-03).
    submit.reset()
    try {
      const fresh = await resolve.mutateAsync({ url: parsed.data, ...(roomId ? { roomId } : {}) })
      // A link that no longer resolves — the place closed, or now matches
      // several branches — is a new answer for the user to see, not something
      // to resubmit behind their back. `resolve.data` already carries it into
      // the view.
      // URL equality cannot distinguish a new A after an A→B→A edit.
      if (generation !== attemptGeneration.current || currentUrl.current.trim() !== verifiedUrl) return
      if (fresh.status !== 'RESOLVED' || !fresh.resolutionToken) return
      await onSubmitPlace(fresh.candidate?.googlePlaceId ?? googlePlaceId, fresh.resolutionToken, true, generation)
    } catch {
      // The retry failed on its own terms; `submit.isError` already says so.
    } finally {
      if (generation === attemptGeneration.current) setRevalidating(false)
    }
  }

  function reset() {
    invalidateAttempt()
    resolve.reset()
    submit.reset()
    currentUrl.current = ''
    setResolvedUrl(null)
    setInvalid(false)
    setMetadataOpen(false)
    setLinkFailed(false)
    setUrl('')
    setSelectedGooglePlaceId(null)
    setCategory(null)
    setVibes([])
    setPriceMin('')
    setPriceMax('')
    setNote('')
    setPhotos([])
  }

  const VerifyButton = result ? GhostBtn : PrimaryBtn
  return (
    <Atmosphere redesign>
      <View testID="import-header" style={[styles.header, { paddingTop: insets.top }]}>
        <BackHeader
          title={t('placeImport.title')}
          onBack={() => router.back()}
          right={<HeaderNotificationButton testID="import-bell" unreadDotTestID="import-unread-dot" />}
        />
      </View>
      <FocusedFieldGroup.Provider value={focusedGroup}>
        <KeyboardAvoidingView testID="import-keyboard-avoider" style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            testID="import-scroll"
            onLayout={(event) => {
              viewportHeight.current = event.nativeEvent.layout.height
              revealFocused()
            }}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y
            }}
            scrollEventThrottle={16}
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: insets.bottom + spacing[6] }}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableWithoutFeedback testID="import-dismiss-keyboard" onPress={Keyboard.dismiss} accessible={false}>
              <View ref={contentRef} collapsable={false}>
                <Text variant="title1" style={styles.introTitle}>
                  {t('placeImport.syncTitle')}
                </Text>
                <Text color="text.secondary" style={styles.body}>
                  {t('placeImport.body')}
                </Text>

                <View style={styles.inputCard}>
                  <Text variant="label">{t('placeImport.linkLabel')}</Text>
                  <View style={styles.linkInputRow}>
                    <TextInput
                      testID="import-link-input"
                      multiline={false}
                      numberOfLines={1}
                      value={url}
                      onChangeText={(value) => {
                        invalidateAttempt()
                        currentUrl.current = value
                        setUrl(value)
                        setResolvedUrl(null)
                        resolve.reset()
                        submit.reset()
                        setSelectedGooglePlaceId(null)
                        setCategory(null)
                        setVibes([])
                        setPriceMin('')
                        setPriceMax('')
                        setNote('')
                        setPhotos([])
                        setInvalid(false)
                      }}
                      placeholder={t('placeImport.placeholder')}
                      placeholderTextColor={theme.text.secondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      accessibilityLabel={t('placeImport.title')}
                      style={[styles.input, styles.linkInput, invalid && styles.inputError]}
                    />
                    {url ? (
                      <Pressable
                        testID="import-clear-link"
                        accessibilityRole="button"
                        accessibilityLabel={t('placeImport.clearLink')}
                        onPress={reset}
                        style={styles.clearLink}
                      >
                        <Icon name="x" size={20} />
                      </Pressable>
                    ) : null}
                  </View>
                  <GhostBtn
                    label={t('placeImport.pasteLink')}
                    onPress={() => {
                      void Clipboard.getStringAsync()
                        .then((value) => {
                          reset()
                          currentUrl.current = value
                          setUrl(value)
                        })
                        .catch(() => setInvalid(true))
                    }}
                  />
                  {invalid && (
                    <Text variant="bodySmall" color="status.dangerText" style={styles.errorLabel}>
                      {t('placeImport.invalidUrl')}
                    </Text>
                  )}

                  <VerifyButton
                    label={t(resolve.isPending ? 'placeImport.verifying' : 'placeImport.verify')}
                    variant="discovery"
                    leadingIcon="verified"
                    onPress={onResolve}
                    loading={resolve.isPending}
                    disabled={url.trim() === ''}
                    style={styles.verifyBtn}
                  />
                </View>

                {resolve.isError ? (
                  <View style={styles.rejectedCard}>
                    <Text variant="title2" color="status.dangerText">
                      {t(providerUnavailable(resolve.error) ? 'placeImport.providerUnavailableTitle' : 'placeImport.rejectedTitle')}
                    </Text>
                    <Text variant="bodySmall" style={styles.rejectedReason}>
                      {providerUnavailable(resolve.error)
                        ? t('placeImport.providerUnavailable')
                        : isApiError(resolve.error) && resolve.error.status === 429
                          ? t('placeImport.rateLimited')
                          : t('common.errorBody')}
                    </Text>
                    <Pressable accessibilityRole="button" onPress={reset} style={styles.tryAgain}>
                      <Text variant="label" color="text.secondary">
                        {t('placeImport.tryAgain')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {result ? (
                  <View style={styles.analysisHeading}>
                    <MaterialIcon name="verified" size={18} color="redesign.greenText" />
                    <Text variant="introHeading" color="redesign.ink" style={styles.analysisLabel}>{t(result.status === 'RESOLVED' ? 'placeImport.extractedTitle' : 'placeImport.analysisTitle')}</Text>
                    {result.status === 'RESOLVED' ? <View style={styles.syncedBadge}><Text variant="introCaptionMedium" color="redesign.importSyncedText">{t('placeImport.syncedBadge')}</Text></View> : null}
                  </View>
                ) : null}

                {/* Already in the catalog — send the user to it instead of creating a
            duplicate submission. */}
                {result?.status === 'ALREADY_EXISTS' && result.existingPlaceId ? (
                  <ExistingPlaceResult placeId={result.existingPlaceId} onReset={reset} />
                ) : null}

                {/* The link matched more than one place; the user picks which. */}
                {result?.status === 'CANDIDATE_SELECTION' ? (
                  <View style={styles.resultCard}>
                    <Text variant="label" style={styles.candidateTitle}>
                      {t('placeImport.pickCandidate')}
                    </Text>
                    {(result.candidates ?? []).map((option) => {
                      const active = selectedGooglePlaceId === option.googlePlaceId
                      return (
                        <Pressable
                          key={option.googlePlaceId}
                          onPress={() => setSelectedGooglePlaceId(option.googlePlaceId ?? null)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[styles.candidateRow, active && styles.candidateRowActive]}
                        >
                          <Text variant="title2">{option.name}</Text>
                          <Text variant="bodySmall" color="text.secondary" style={styles.candidateAddress}>
                            {option.address}
                          </Text>
                        </Pressable>
                      )
                    })}
                    <PrimaryBtn
                      label={t('placeImport.submit')}
                      icon="send"
                      onPress={() => {
                        if (selectedGooglePlaceId) void onSubmitPlace(selectedGooglePlaceId)
                      }}
                      disabled={!selectedGooglePlaceId || submit.isSuccess}
                      loading={submit.isPending || revalidating}
                      style={styles.addBtn}
                    />
                    {submitError ? (
                      <Text variant="bodySmall" color="status.dangerText" style={styles.errorLabel}>
                        {submitError}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {result?.status === 'RESOLVED' && candidate && !submit.data?.placeId ? (
                  <PlaceCard
                    variant="preview"
                    preview={candidate}
                    saveAction={<Pressable accessibilityRole="button" accessibilityLabel={t('placeDetail.save')} accessibilityHint={t('placeImport.saveLocked')} accessibilityState={{ disabled: true }} disabled style={styles.previewSave}><MaterialIcon name="bookmark" color="redesign.outline" /></Pressable>}
                    style={styles.resultCard}
                    categoryLabel={candidate.categoryKey ? taxonomyOptions('category').find((option) => option.key === candidate.categoryKey)?.label : null}
                  >
                    {/* Google's business status is a fact worth surfacing: submitting a
                  closed place wastes a moderator's time and the user's. */}
                    {candidate.businessStatus && candidate.businessStatus !== 'OPERATIONAL' ? (
                      <View style={styles.warning}>
                        <Icon name="alert" size={16} color="status.warningText" />
                        <Text variant="bodySmall" color="status.warningText" style={styles.warningText}>
                          {t(`placeImport.businessStatus.${candidate.businessStatus}`, {
                            defaultValue: t('placeImport.businessStatusUnknown'),
                          })}
                        </Text>
                      </View>
                    ) : null}

                    <Text variant="caption" color="text.secondary">
                      {t('placeImport.saveLocked')}
                    </Text>
                    {actorStatus === 'user' && !submit.isSuccess ? <Text variant="bodySmall">{t('placeImport.approvalCredit')}</Text> : null}
                    {candidate.googleMapsUri ? (
                      <GhostBtn
                        label={t('placeImport.googleLink')}
                        onPress={() => {
                          void openWebsite(candidate.googleMapsUri as string).then((ok) => setLinkFailed(!ok))
                        }}
                      />
                    ) : null}
                    {linkFailed ? <Text color="status.dangerText">{t('placeDetail.linkFailed')}</Text> : null}
                    {/* Optional metadata (PI-APP-004) — moderators get better context
                  when the submitter fills it in, and nothing here is required. */}
                    {!submit.isSuccess ? <GhostBtn label={t('placeImport.metaTitle')} onPress={() => setMetadataOpen((value) => !value)} /> : null}
                    {!submit.isSuccess ? <ImportPhotos photos={photos} onChange={setPhotos} /> : null}
                    {!submit.isSuccess && metadataOpen ? (
                      <View style={styles.metaSection}>
                        <Text variant="label" style={styles.metaLabel}>
                          {t('placeImport.metaCategory')}
                        </Text>
                        <View style={styles.chipRow}>
                          {taxonomyOptions('category').map((option) => {
                            const active = category === option.key
                            return (
                              <Pressable
                                key={option.key}
                                onPress={() => setCategory(active ? null : option.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                style={[styles.chip, active && styles.chipActive]}
                              >
                                <Text variant={active ? 'label' : 'bodySmall'} color={active ? 'accent.onAccent' : 'text.primary'}>
                                  {option.label}
                                </Text>
                              </Pressable>
                            )
                          })}
                        </View>

                        <Text variant="label" style={styles.metaLabel}>
                          {t('placeImport.metaVibes', { max: MAX_VIBES })}
                        </Text>
                        <View style={styles.chipRow}>
                          {taxonomyOptions('mood').map((option) => {
                            const active = vibes.includes(option.key)
                            return (
                              <Pressable
                                key={option.key}
                                onPress={() => toggleVibe(option.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                style={[styles.chip, active && styles.chipActive]}
                              >
                                <Text variant={active ? 'label' : 'bodySmall'} color={active ? 'accent.onAccent' : 'text.primary'}>
                                  {option.label}
                                </Text>
                              </Pressable>
                            )
                          })}
                        </View>

                        <FieldFocusGroup>
                          <Text variant="label" style={styles.metaLabel}>
                            {t('placeImport.metaPrice')}
                          </Text>
                          <View style={styles.priceRow}>
                            <TextInput
                              onFocus={revealFocused}
                              accessibilityLabel={t('search.priceFrom')}
                              value={priceMin}
                              onChangeText={setPriceMin}
                              placeholder={t('search.priceFrom')}
                              placeholderTextColor={theme.text.secondary}
                              keyboardType="numeric"
                              style={[styles.input, styles.priceInput]}
                            />
                            <TextInput
                              onFocus={revealFocused}
                              accessibilityLabel={t('search.priceTo')}
                              value={priceMax}
                              onChangeText={setPriceMax}
                              placeholder={t('search.priceTo')}
                              placeholderTextColor={theme.text.secondary}
                              keyboardType="numeric"
                              style={[styles.input, styles.priceInput]}
                            />
                          </View>

                          <Text variant="caption" color="text.secondary">
                            {t('placeImport.priceHelper')}
                          </Text>
                        </FieldFocusGroup>
                        <FieldFocusGroup>
                          <TextInput
                            onFocus={revealFocused}
                            accessibilityLabel={t('placeImport.metaNote')}
                            value={note}
                            onChangeText={(value) => setNote(value.slice(0, MAX_NOTE))}
                            placeholder={t('placeImport.metaNote')}
                            placeholderTextColor={theme.text.secondary}
                            multiline
                            scrollEnabled
                            style={[styles.input, styles.noteInput]}
                          />
                          <Text variant="caption" color="text.secondary">
                            {t('placeImport.noteHelper', { count: note.length, max: MAX_NOTE })}
                          </Text>
                        </FieldFocusGroup>
                      </View>
                    ) : null}

                    {!submit.isSuccess ? (
                      <>
                        <PrimaryBtn
                          label={t('placeImport.submit')}
                          icon="send"
                          onPress={() => {
                            if (candidate.googlePlaceId) void onSubmitPlace(candidate.googlePlaceId)
                          }}
                          loading={submit.isPending || revalidating}
                          // #131: the server refuses an unopened place (409
                          // PLACE_NOT_YET_OPEN). The reason sits with the button and
                          // is read with it (#316 F-02).
                          disabled={!candidate.googlePlaceId || notOpenYet}
                          accessibilityHint={notOpenYet ? t('placeImport.notYetOpen') : undefined}
                          style={styles.addBtn}
                        />
                        {notOpenYet ? (
                          <Text variant="bodySmall" color="status.dangerText" style={styles.errorLabel}>
                            {t('placeImport.notYetOpen')}
                          </Text>
                        ) : null}
                      </>
                    ) : null}

                    {submitError && !notOpenYet ? (
                      <Text variant="bodySmall" color="status.dangerText" style={styles.errorLabel}>
                        {submitError}
                      </Text>
                    ) : null}
                  </PlaceCard>
                ) : null}

                {previewMatchesUrl && submit.isSuccess ? (
                  submit.data?.placeId ? (
                    <ExistingPlaceResult placeId={submit.data.placeId} onReset={reset} />
                  ) : (
                    <View style={styles.resultBody}>
                      {!submission.data?.status || submission.data.status === 'pending' ? <Text variant="label">{t('placeImport.pendingReview')}</Text> : null}
                      {submission.data?.status ? <Text>{t(`placeImport.submissionStatus.${submission.data.status}`)}</Text> : null}
                      {(submission.data?.status === 'approved' || submission.data?.status === 'merged') && submission.data.placeId ? (
                        <ExistingPlaceResult placeId={submission.data.placeId} onReset={reset} />
                      ) : null}
                      {submission.isError ? (
                        <>
                          <Text>
                            {t(isApiError(submission.error) && submission.error.status === 403 ? 'placeImport.ownerOnlyStatus' : 'placeImport.statusFailed')}
                          </Text>
                          {!(isApiError(submission.error) && submission.error.status === 403) ? (
                            <GhostBtn
                              label={t('common.retry')}
                              onPress={() => {
                                void submission.refetch()
                              }}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </View>
                  )
                ) : null}

                {result?.status === 'UNRESOLVED' ? (
                  <View style={styles.rejectedCard}>
                    <Text variant="title2" color="status.dangerText">
                      {t('placeImport.rejectedTitle')}
                    </Text>
                    <Text variant="bodySmall" style={styles.rejectedReason}>
                      {t(`placeImport.reason.${result.reasonCodes?.[0] ?? 'NOT_FOUND'}`, {
                        defaultValue: t('placeImport.reason.NOT_FOUND'),
                      })}
                    </Text>
                    <GhostBtn label={t('placeImport.tryAgain')} onPress={reset} />
                  </View>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </FocusedFieldGroup.Provider>
    </Atmosphere>
  )
}
