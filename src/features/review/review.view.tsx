import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { toPlanSummary, useCreateReview, usePlan, usePlanStopPlaces, type Review } from '@/shared/api'
import { track } from '@/shared/analytics'
import type { MessageKey } from '@/shared/i18n/types'
import { haptic } from '@/shared/ui/feedback'
import { Badge } from '@/shared/ui/badge.view'
import { Atmosphere, BackHeader, Card, Chip, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './review.style'

const MAX_TEXT = 2000
/** Where the counter starts warning rather than just informing. */
const COUNTER_WARN_AT = MAX_TEXT - 100

/** The whole-outing review, which carries `planId` and no place. */
const OVERALL = 'plan'

/**
 * FR-PLAN-007 — "review từng stop và toàn bộ trải nghiệm". A review is filed
 * against one subject at a time: the plan, or one of its stops.
 */
interface Subject {
  /** `OVERALL`, or the stop's place id. */
  key: string
  /** `undefined` for the whole outing; the place reviewed otherwise. */
  placeId?: string
  label: string
}

function ratingLabelKey(rating: number): MessageKey {
  if (rating === 0) return 'review.chooseStars'
  if (rating <= 2) return 'review.rating.bad'
  if (rating <= 3) return 'review.rating.ok'
  if (rating <= 4) return 'review.rating.great'
  return 'review.rating.perfect'
}

export default function ReviewScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const { planId } = useLocalSearchParams<{ planId: string }>()

  const plan = usePlan(planId)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const stops = useMemo(() => summary?.stops ?? [], [summary])
  const places = usePlanStopPlaces(stops)
  const createReview = useCreateReview()

  /**
   * GoGo-MobileApp#277 — the app only ever filed `{planId, rating, text}`, so
   * every review it created was stored with `place_id = null` and could never
   * reach a place's review list, which filters on `place_id`. The subject is
   * what was missing, not the endpoint: `POST /reviews` has always taken an
   * optional `placeId`.
   *
   * A place appears once however many stops use it — two reviews of the same
   * place from one outing is not a thing the user is asking for.
   */
  const subjects = useMemo<Subject[]>(() => {
    const seen = new Set<string>()
    const perStop: Subject[] = []
    stops.forEach((stop, index) => {
      if (!stop.placeId || seen.has(stop.placeId)) return
      seen.add(stop.placeId)
      perStop.push({
        key: stop.placeId,
        placeId: stop.placeId,
        // The place detail may still be loading, or may have failed; the stop
        // is reviewable either way, so it falls back to its position rather
        // than disappearing.
        label: places.byPlaceId.get(stop.placeId)?.name ?? t('datePlan.stopOrder', { n: index + 1 }),
      })
    })
    return [{ key: OVERALL, label: t('review.subjectOverall') }, ...perStop]
  }, [stops, places.byPlaceId, t])

  const [subjectKey, setSubjectKey] = useState(OVERALL)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<Review | null>(null)
  /** Subjects reviewed in this sitting; the server owns the durable answer. */
  const [sent, setSent] = useState<readonly string[]>([])
  /**
   * Synchronous latch: `isPending` only reaches the button on the next render,
   * so two quick taps would both POST, and the server keeps every review it is
   * sent. One review per tap, whatever the render timing.
   */
  const inFlight = useRef(false)

  const subject = subjects.find(candidate => candidate.key === subjectKey) ?? subjects[0]
  const remaining = subjects.filter(candidate => !sent.includes(candidate.key))

  function onContinue() {
    const roomId = plan.data?.roomId
    if (roomId) router.replace(`/room/${roomId}/shared-result`)
    else router.replace('/(tabs)')
  }

  /** Back to an empty form for the next unreviewed subject. */
  function reviewAnother() {
    const next = remaining[0]
    if (!next) return
    setSubjectKey(next.key)
    setRating(0)
    setText('')
    setError(null)
    setSubmitted(null)
  }

  function pick(next: Subject) {
    if (next.key === subjectKey) return
    setSubjectKey(next.key)
    // The stars and the words belong to the subject they were written about.
    setRating(0)
    setText('')
    setError(null)
  }

  async function submit() {
    // The contract requires 1..5, and the button is disabled below that.
    if (rating === 0 || inFlight.current) return
    inFlight.current = true
    setError(null)

    try {
      const review = await createReview.mutateAsync({
        planId,
        ...(subject?.placeId ? { placeId: subject.placeId } : {}),
        rating,
        ...(text.trim() ? { text: text.trim() } : {}),
      })
      track('review_submitted', { rating, status: review.status, subject: subject?.placeId ? 'place' : 'plan' })
      haptic('success')
      if (subject) setSent(previous => [...previous, subject.key])
      // The review does not vanish into a navigation — what happens to it next
      // is the answer the user is owed (spec §27).
      setSubmitted(review)
    } catch {
      haptic('error')
      setError(t('review.failed'))
    } finally {
      inFlight.current = false
    }
  }

  if (submitted) {
    // A new or edited review starts at `pending` until moderation. Saying so is
    // the difference between "published" and "will be looked at" — and no CMS
    // moderator detail is exposed either way.
    const pending = submitted.status === 'pending'
    // `POST /reviews` answers only id and status on DEV, though the contract
    // requires `rating`; what this person sent is the fact to show.
    const sentRating = submitted.rating ?? rating
    return (
      <Atmosphere>
        <View style={styles.successRoot}>
          <View style={[styles.successHalo, pending && styles.successHaloPending]}>
            <View style={[styles.successDisc, pending && styles.successDiscPending]}>
              <Icon name={pending ? 'clock' : 'check'} size={32} color="text.inverse" />
            </View>
          </View>
          <Text variant="title1" style={styles.successTitle} accessibilityRole="header">
            {t('review.successTitle')}
          </Text>
          <Text color="text.secondary" style={styles.successBody} accessibilityLiveRegion="polite">
            {t(pending ? 'review.successPending' : 'review.successPublished')}
          </Text>
          <Card style={styles.successCard}>
            <Badge
              label={t(`myReviews.status.${submitted.status}`, { defaultValue: submitted.status })}
              tone={pending ? 'warning' : 'success'}
              style={styles.successBadge}
            />
            <View style={styles.successSubject}>
              <Text variant="title2" style={styles.successSubjectName} numberOfLines={1}>{subject?.label}</Text>
              <View style={styles.successStars} accessible accessibilityLabel={t('review.starAria', { count: sentRating })}>
                {[1, 2, 3, 4, 5].map(value => (
                  <Icon key={value} name="star" size={16} color="accent.primary" filled={value <= sentRating} />
                ))}
              </View>
            </View>
          </Card>
          <View style={styles.successActions}>
            <PrimaryBtn label={t('review.continue')} onPress={onContinue} />
            {/* The other stops are the point of #277: one review per subject,
                and the way to the next one is here rather than a second trip
                through the date. */}
            {remaining.length > 0 ? (
              <GhostBtn label={t('review.another', { name: remaining[0].label })} onPress={reviewAnother} />
            ) : null}
          </View>
        </View>
      </Atmosphere>
    )
  }

  const nearLimit = text.length >= COUNTER_WARN_AT
  const reviewingPlace = Boolean(subject?.placeId)

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} title={t('profile.shortcut.reviews')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[6] }}>
        <Text variant="display" style={styles.title}>
          {reviewingPlace ? t('review.titlePlace', { name: subject?.label }) : t('review.title')}
        </Text>
        <Text color="text.secondary" style={styles.body}>{reviewingPlace ? t('review.bodyPlace') : t('review.body')}</Text>

        {/* One stop is not a choice; the selector only exists where there is
            something to choose between. */}
        {subjects.length > 1 ? (
          <View style={styles.subjects}>
            <Text variant="caption" color="text.secondary" style={styles.subjectLabel}>{t('review.subjectLabel')}</Text>
            <View style={styles.subjectRow}>
              {subjects.map(candidate => {
                const isSent = sent.includes(candidate.key)
                return (
                  <Chip
                    key={candidate.key}
                    // Neither state is colour alone: `selected` prefixes a check
                    // glyph and sets `accessibilityState.selected`; "sent" is
                    // said in words on the chip itself, so the two never share
                    // the same mark. The marker leads: the chip is one line and
                    // truncates at the tail, so a long place name is what gets
                    // clipped, never the word "sent".
                    label={isSent ? t('review.subjectSent', { name: candidate.label }) : candidate.label}
                    variant={candidate.key === subjectKey ? 'selected' : isSent ? 'positive' : 'default'}
                    accessibilityLabel={
                      isSent ? t('review.subjectDone', { name: candidate.label }) : candidate.label
                    }
                    onPress={() => pick(candidate)}
                  />
                )
              })}
            </View>
          </View>
        ) : null}

        <Card padded={false} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="title2">{t('review.chooseStars')}</Text>
          </View>
          <View style={styles.starsRow} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map(value => (
              <Pressable
                key={value}
                onPress={() => {
                  haptic('select')
                  setRating(value)
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: value === rating }}
                accessibilityLabel={t('review.starAria', { count: value })}
                style={styles.starTap}
              >
                <Icon name="star" size={32} color="accent.primary" filled={value <= rating} />
              </Pressable>
            ))}
          </View>
          <View style={[styles.ratingPill, rating === 0 && styles.ratingPillIdle]}>
            <Text variant="title2" color={rating === 0 ? 'text.secondary' : 'accent.onSoft'} accessibilityLiveRegion="polite">
              {t(ratingLabelKey(rating))}
            </Text>
          </View>
        </Card>

        {/*
          The highlight chips are gone: `POST /reviews` takes only `rating` and
          `text`, with no tags field and no review-tag taxonomy to draw from
          (GoGo-BE#171). Collecting chips that could not be submitted would be
          worse than not offering them.
        */}
        <Card padded={false} style={styles.section}>
          <TextInput
            value={text}
            onChangeText={value => setText(value.slice(0, MAX_TEXT))}
            placeholder={t('review.placeholder')}
            placeholderTextColor={theme.text.secondary}
            multiline
            accessibilityLabel={t('review.placeholder')}
            style={styles.input}
          />
          {/* The count only matters as the limit approaches; until then it is
              quiet rather than absent, so the cap is never a surprise. */}
          <View style={styles.counterRow}>
            <Text variant={nearLimit ? 'label' : 'caption'} color={nearLimit ? 'status.warningText' : 'text.secondary'}>
              {text.length} / {MAX_TEXT}
            </Text>
          </View>
        </Card>

        {/* A new review is queued for moderation, never published on the spot. */}
        <View style={styles.moderationNote}>
          <Icon name="info" size={20} color="text.secondary" />
          <Text variant="bodySmall" color="text.secondary" style={styles.moderationText}>{t('review.moderationNote')}</Text>
        </View>

        {error ? (
          <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing[4] }]}>
        {rating === 0 ? <Text variant="bodySmall" color="text.secondary" style={styles.hint}>{t('review.chooseStars')}</Text> : null}
        <PrimaryBtn
          label={createReview.isPending ? t('review.submitting') : t('review.submit')}
          onPress={submit}
          disabled={rating === 0}
          loading={createReview.isPending}
        />
        <GhostBtn label={t('review.skip')} onPress={onContinue} />
      </View>
    </Atmosphere>
  )
}
