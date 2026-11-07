import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TouchableWithoutFeedback, View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'
import { onlineManager } from '@tanstack/react-query'
import { NetworkError } from '@/shared/api/errors'
import { ImportGuide } from './import-guide.view'

import { discoveryLabels, isApiError, usePlaceSubmission, useResolveGoogleMapsLink, useSubmitPlace, useTaxonomies, type ResolveLinkResult } from '@/shared/api'
import { track } from '@/shared/analytics'
import { Icon } from '@/shared/ui/icons'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { openWebsite } from '@/shared/navigation/external-links'
import { useSession } from '@/shared/providers/session-provider'
import { ContributionWizard } from './contribution-wizard.view'
import type { Enrichment } from './contribution-form'
import { FieldFocusGroup, FocusedFieldGroup } from '@/shared/ui/field-focus-group'
import { ExistingPlaceResult } from './existing-place-result.view'
import { Atmosphere, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import * as Clipboard from 'expo-clipboard'
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
        ['https:', 'http:'].includes(parsed.protocol) &&
        (host === 'maps.google.com' ||
          host === 'maps.app.goo.gl' ||
          (host === 'goo.gl' && parsed.pathname.startsWith('/maps/')) ||
          (host === 'google.com' && /^\/maps(?:\/|$)/.test(parsed.pathname)) ||
          (host.endsWith('.google.com') && /^\/maps(?:\/|$)/.test(parsed.pathname)))
      )
    } catch {
      return false
    }
  })

type Candidate = NonNullable<ResolveLinkResult['candidate']>

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

export default function PlaceImportScreen() {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const { status: actorStatus } = useSession()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId?: string }>()

  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline(), () => onlineManager.isOnline())
  const inputRef = useRef<import('@/shared/ui/text-input').TextInputRef>(null)
  const [linkFocused, setLinkFocused] = useState(false)
  const focusedGroup = useRef<View>(null)
  const scrollRef = useRef<ScrollView>(null)
  const guideY = useRef(0)
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
  const [formGeneration, setFormGeneration] = useState(0)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [linkFailed, setLinkFailed] = useState(false)
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState<string | null>(null)
  // True only during the silent re-resolve of a stale attestation, so the CTA
  // keeps its loading state across the two requests instead of flickering back
  // to idle between them (APP-042).
  const submitLock = useRef(false)
  const [revalidating, setRevalidating] = useState(false)

  const enrichment = useRef<Enrichment | undefined>(undefined)
  const taxonomies = useTaxonomies({ kinds: 'category' })
  const resolve = useResolveGoogleMapsLink()
  const submit = useSubmitPlace()
  // A proposal is queued for moderation, so its status is polled after sending.
  const submission = usePlaceSubmission(submit.data?.status === 'ALREADY_EXISTS' ? undefined : submit.data?.submissionId)

  function taxonomyOptions(kind: string) {
    return Object.entries(discoveryLabels(taxonomies.data, i18n.language)[kind] ?? {}).map(([key, label]) => ({ key, label }))
  }

  const previewMatchesUrl = resolvedUrl !== null && resolvedUrl === url.trim()
  const result = previewMatchesUrl ? resolve.data : undefined
  const candidate = result?.candidate as Candidate | undefined
  // #131: Google lists it as opening soon; the server refuses the submit.
  useEffect(() => {
    if (result?.status === 'RESOLVED') scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [result?.status])
  const notOpenYet = candidate?.businessStatus === 'FUTURE_OPENING'

  function invalidateAttempt() {
    attemptGeneration.current += 1
    setFormGeneration(value => value + 1)
    submitLock.current = false
    setRevalidating(false)
  }

  function onResolve() {
    if (!online || resolve.isPending) return
    Keyboard.dismiss()
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
      !online ||
      !enrichment.current ||
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
        ...(enrichment.current ? { enrichment: enrichment.current } : {}),
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
      if (fresh.status !== 'RESOLVED' || !fresh.resolutionToken || fresh.candidate?.googlePlaceId !== googlePlaceId) return
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
    setLinkFailed(false)
    setUrl('')
    setSelectedGooglePlaceId(null)
    enrichment.current = undefined
  }

  const verified = result?.status === 'RESOLVED' && !!candidate
  const contributionPlaceId = verified ? candidate.googlePlaceId : result?.status === 'CANDIDATE_SELECTION' ? selectedGooglePlaceId : undefined
  const offline = !online || resolve.isPaused || (resolve.isError && resolve.error instanceof NetworkError)
  const validFormat = mapsUrlSchema.safeParse(url).success
  const showValidation = url.trim().length > 0 || invalid

  function changeLink() {
    reset()
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      inputRef.current?.focus()
    })
  }

  async function pasteLink() {
    const generation = attemptGeneration.current
    try {
      const value = await Clipboard.getStringAsync()
      if (generation !== attemptGeneration.current) return
      reset()
      currentUrl.current = value.trim()
      setUrl(value.trim())
      inputRef.current?.focus()
    } catch {
      if (generation === attemptGeneration.current) setLinkFailed(true)
    }
  }

  return (
    <Atmosphere redesign style={!verified ? styles.inputCanvas : undefined}>
      <View testID="import-header" style={[styles.header, !verified && styles.inputCanvas, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={verified ? changeLink : () => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Icon name="chevronLeft" size={24} />
          </Pressable>
          <Text variant="introHeading" color="redesign.ink" style={[styles.headerTitle, !verified && styles.headerTitleCentered]}>{t(verified ? 'placeImport.metaTitle' : 'placeImport.title')}</Text>
          {!verified ? <Pressable accessibilityRole="button" accessibilityLabel={t('placeImport.help')} onPress={() => { Keyboard.dismiss(); scrollRef.current?.scrollTo({ y: guideY.current, animated: true }) }} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <MaterialIcon name="help" size={24} color="redesign.secondary" />
          </Pressable> : null}
          <HeaderNotificationButton testID="import-bell" unreadDotTestID="import-unread-dot" />
        </View>
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
                <View style={styles.intro}>
                  {!verified ? <View style={styles.introBadge}>
                    <MaterialIcon name="groups" size={16} color="redesign.primaryText" />
                    <Text variant="introLabel" color="redesign.primaryText">{t('placeImport.community')}</Text>
                  </View> : null}
                  <Text variant={verified ? 'introSection' : 'display'} color="redesign.ink">{t(verified ? 'placeImport.completeTitle' : 'placeImport.syncTitle')}</Text>
                  <Text variant={verified ? "introBody" : "bodySmall"} color="redesign.secondary" style={styles.introBody}>{t(verified ? 'placeImport.completeBody' : 'placeImport.body')}</Text>
                </View>

                {verified ? <View testID="import-synced-link" style={styles.syncedRow}>
                  <View style={styles.linkDisc}><MaterialIcon name="link" size={20} color="redesign.importSyncedText" /></View>
                  <View style={styles.syncedText}>
                    <View style={styles.syncedTitleRow}>
                      <Text numberOfLines={1} variant="introLabel" color="redesign.ink" style={styles.syncedUrl}>{resolvedUrl?.replace(/^https?:\/\//, '')}</Text>
                      <View testID="import-verified-confirmation" style={styles.syncedBadge}><MaterialIcon name="checkCircle" size={14} color="redesign.importSyncedText" /><Text variant="introCaptionMedium" color="redesign.importSyncedText">{t('placeImport.synced')}</Text></View>
                    </View>
                    <Text numberOfLines={1} variant="introCaption" color="redesign.secondary">{t('placeImport.verifiedLocation', { name: candidate.name })}</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={changeLink} style={({ pressed }) => [styles.changeLink, pressed && styles.pressed]}>
                    <MaterialIcon name="restart" size={14} /><Text variant="introCaptionMedium" color="redesign.ink">{t('placeImport.changeLink')}</Text>
                  </Pressable>
                </View> : <>
                  <FieldFocusGroup style={[styles.inputCard, linkFocused && styles.inputCardFocused]}>
                    <View style={styles.inputHeading}>
                      <View style={styles.inputLabel}><MaterialIcon name="link" size={18} color="redesign.primaryText" /><Text variant="introLabel" color="redesign.ink">{t('placeImport.linkLabel')}</Text></View>
                      <Pressable accessibilityRole="button" onPress={() => void pasteLink()} style={({ pressed }) => [styles.pasteLink, pressed && styles.pressed]}>
                        <Icon name="copy" size={14} color="redesign.primaryText" /><Text variant="introLabel" color="redesign.primaryText">{t('placeImport.pasteLink')}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.linkInputRow}>
                      <View pointerEvents="none" style={styles.inputLocation}><MaterialIcon name="location" size={20} color="redesign.greenText" /></View>
                      <TextInput
                        ref={inputRef}
                        testID="import-link-input"
                        multiline={false}
                        numberOfLines={1}
                        scrollEnabled
                        onFocus={() => { setLinkFocused(true); revealFocused() }}
                        onBlur={() => setLinkFocused(false)}
                        value={url}
                        onChangeText={(value) => {
                          reset()
                          currentUrl.current = value
                          setUrl(value)
                        }}
                        placeholder={t('placeImport.placeholder')}
                        placeholderTextColor={theme.redesign.outline}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        returnKeyType="go"
                        onSubmitEditing={onResolve}
                        accessibilityLabel={t('placeImport.linkLabel')}
                        accessibilityHint={showValidation && !validFormat ? t('placeImport.invalidUrl') : undefined}
                        style={[styles.input, styles.linkInput, !linkFocused && !!url && styles.linkInputUnfocused, showValidation && !validFormat && styles.inputError]}
                      />
                      {!linkFocused && !!url ? <View testID="import-link-display" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.linkDisplay}>
                        <Text variant="bodySmall" numberOfLines={1} ellipsizeMode="tail">{url}</Text>
                      </View> : null}
                      {url ? <Pressable testID="import-clear-link" accessibilityRole="button" accessibilityLabel={t('placeImport.clearLink')} onPress={changeLink} style={({ pressed }) => [styles.clearLink, pressed && styles.pressed]}><View style={styles.clearDisc}><Icon name="x" size={14} /></View></Pressable> : null}
                    </View>
                    {showValidation ? <View accessibilityLiveRegion="polite" style={[styles.validationBadge, !validFormat && styles.validationInvalid]}>
                      <MaterialIcon name={validFormat ? 'checkCircle' : 'info'} size={15} color={validFormat ? 'redesign.greenText' : 'status.warningText'} />
                      <Text variant="introCaptionMedium" color={validFormat ? 'redesign.greenText' : 'status.warningText'} style={styles.flex}>{t(validFormat ? 'placeImport.validFormat' : 'placeImport.invalidUrl')}</Text>
                    </View> : null}
                    <View style={styles.formatHint}><MaterialIcon name="info" size={13} color="redesign.outline" /><Text variant="introCaption" color="redesign.secondary" style={styles.flex}>{t('placeImport.formatHint')}</Text></View>
                    {linkFailed ? <Text variant="introSmall" color="status.dangerText">{t('placeImport.clipboardFailed')}</Text> : null}
                  </FieldFocusGroup>
                  {!result ? <View onLayout={event => { guideY.current = event.nativeEvent.layout.y }}><ImportGuide onLinkFailed={() => setLinkFailed(true)} /></View> : null}
                  <View style={styles.inputActions}>
                    {offline ? <View accessibilityLiveRegion="polite" style={styles.offline}><MaterialIcon name="info" color="status.warningText" /><Text variant="introSmall" style={styles.flex}>{t('placeImport.offline')}</Text></View> : null}
                    <PrimaryBtn label={t(resolve.isPending && !offline ? 'placeImport.verifying' : 'placeImport.verify')} variant="discovery" trailingIcon="arrowRight" onPress={onResolve} loading={resolve.isPending && !offline} disabled={!url.trim() || !online || resolve.isPaused} style={url.trim() && online && !resolve.isPaused ? styles.inputPrimary : undefined} />
                  </View>
                </>}

                {resolve.isError && !offline ? (
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
                    <Pressable accessibilityRole="button" onPress={onResolve} style={styles.tryAgain}>
                      <Text variant="label" color="text.secondary">
                        {t('common.retry')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {result ? (
                  <View style={styles.analysisHeading}>
                    <Text variant="introHeading" color="redesign.ink" style={styles.analysisLabel}>{t(result.status === 'RESOLVED' ? 'placeImport.extractedTitle' : 'placeImport.analysisTitle')}</Text>
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
                          onPress={() => { enrichment.current = undefined; setSelectedGooglePlaceId(option.googlePlaceId ?? null) }}
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
                    headerAction={candidate.googleMapsUri ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('placeImport.googleLink')}
                        onPress={() => {
                          void openWebsite(candidate.googleMapsUri!).then((ok) => setLinkFailed(!ok))
                        }}
                        style={styles.previewMaps}
                      >
                        <MaterialIcon name="map" color="redesign.primaryText" />
                      </Pressable>
                    ) : null}
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

                    {linkFailed ? <Text color="status.dangerText">{t('placeDetail.linkFailed')}</Text> : null}
                    {submitError && !notOpenYet ? (
                      <Text variant="bodySmall" color="status.dangerText" style={styles.errorLabel}>
                        {submitError}
                      </Text>
                    ) : null}
                  </PlaceCard>
                ) : null}

                {contributionPlaceId && !submit.isSuccess ? (
                  <ContributionWizard
                    key={`${formGeneration}:${contributionPlaceId}`}
                    googlePlaceId={contributionPlaceId}
                    registered={actorStatus === 'user'}
                    online={online}
                    submitting={submit.isPending || revalidating}
                    blocked={notOpenYet}
                    onBack={changeLink}
                    onFocus={revealFocused}
                    onSubmit={(value) => {
                      enrichment.current = value
                      void onSubmitPlace(contributionPlaceId)
                    }}
                  />
                ) : null}
                {verified && notOpenYet ? <Text color="status.dangerText">{t('placeImport.notYetOpen')}</Text> : null}

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
