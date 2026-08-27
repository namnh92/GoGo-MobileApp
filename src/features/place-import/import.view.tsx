import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { isApiError, useResolveGoogleMapsLink, useSubmitPlace, type ResolveLinkResult } from '@/shared/api'
import { track } from '@/shared/analytics'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './import.style'

// Accepted Google Maps link shapes (SRS FR-PLACE-001). The server validates
// again — this only keeps an obviously wrong paste from costing a round trip.
const mapsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine(value => {
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

export default function PlaceImportScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId?: string }>()

  const [url, setUrl] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState<string | null>(null)

  const resolve = useResolveGoogleMapsLink()
  const submit = useSubmitPlace()

  const result = resolve.data
  const candidate = result?.candidate as Candidate | undefined

  function onResolve() {
    const parsed = mapsUrlSchema.safeParse(url)
    if (!parsed.success) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setSelectedGooglePlaceId(null)
    submit.reset()
    track('place_import_submitted')

    resolve.mutate(
      { url: parsed.data, ...(roomId ? { roomId } : {}) },
      {
        onSuccess: resolved => {
          if (resolved.status === 'RESOLVED') track('place_import_verified', { placeId: resolved.candidate?.googlePlaceId ?? '' })
          else track('place_import_rejected', { reason: resolved.status ?? 'UNRESOLVED' })
        },
      },
    )
  }

  function onSubmitPlace(googlePlaceId: string) {
    submit.mutate(
      { googlePlaceId, ...(roomId ? { roomId } : {}) },
      {
        onSuccess: submission => {
          track('place_import_added', { placeId: submission.placeId ?? googlePlaceId })
        },
      },
    )
  }

  function reset() {
    resolve.reset()
    submit.reset()
    setUrl('')
    setSelectedGooglePlaceId(null)
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('placeImport.title')}</Text>
        <Text style={styles.body}>{t('placeImport.body')}</Text>

        <TextInput
          value={url}
          onChangeText={value => {
            setUrl(value)
            setInvalid(false)
          }}
          placeholder={t('placeImport.placeholder')}
          placeholderTextColor={colors.neutral[300]}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel={t('placeImport.title')}
          style={[styles.input, invalid && styles.inputError]}
        />
        {invalid && <Text style={styles.errorLabel}>{t('placeImport.invalidUrl')}</Text>}

        {resolve.isPending ? (
          <View style={styles.verifyingRow}>
            <ActivityIndicator color={colors.brand.coral} />
            <Text style={styles.verifyingLabel}>{t('placeImport.verifying')}</Text>
          </View>
        ) : (
          <PrimaryBtn
            label={t('placeImport.verify')}
            onPress={onResolve}
            disabled={url.trim() === ''}
            style={styles.verifyBtn}
          />
        )}

        {resolve.isError ? (
          <View style={styles.rejectedCard}>
            <Text style={styles.rejectedTitle}>{t('placeImport.rejectedTitle')}</Text>
            <Text style={styles.rejectedReason}>
              {isApiError(resolve.error) && resolve.error.status === 429
                ? t('placeImport.rateLimited')
                : t('common.errorBody')}
            </Text>
            <Pressable onPress={reset} style={styles.tryAgain}>
              <Text style={styles.tryAgainLabel}>{t('placeImport.tryAgain')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Already in the catalog — send the user to it instead of creating a
            duplicate submission. */}
        {result?.status === 'ALREADY_EXISTS' ? (
          <GlassCard style={styles.resultCard}>
            <View style={styles.resultBody}>
              <Text style={styles.placeName}>{candidate?.name ?? t('placeImport.existsTitle')}</Text>
              <Text style={styles.placeAddress}>{t('placeImport.existsBody')}</Text>
              {result.existingPlaceId ? (
                <PrimaryBtn
                  label={t('placeImport.openPlace')}
                  onPress={() => router.replace(`/places/${result.existingPlaceId}`)}
                  style={styles.addBtn}
                />
              ) : null}
            </View>
          </GlassCard>
        ) : null}

        {/* The link matched more than one place; the user picks which. */}
        {result?.status === 'CANDIDATE_SELECTION' ? (
          <View style={styles.resultCard}>
            <Text style={styles.candidateTitle}>{t('placeImport.pickCandidate')}</Text>
            {(result.candidates ?? []).map(option => {
              const active = selectedGooglePlaceId === option.googlePlaceId
              return (
                <Pressable
                  key={option.googlePlaceId}
                  onPress={() => setSelectedGooglePlaceId(option.googlePlaceId ?? null)}
                  accessibilityState={{ selected: active }}
                  style={[styles.candidateRow, active && styles.candidateRowActive]}
                >
                  <Text style={styles.candidateName}>{option.name}</Text>
                  <Text style={styles.candidateAddress}>{option.address}</Text>
                </Pressable>
              )
            })}
            <PrimaryBtn
              label={t('placeImport.submit')}
              onPress={() => selectedGooglePlaceId && onSubmitPlace(selectedGooglePlaceId)}
              disabled={!selectedGooglePlaceId}
              loading={submit.isPending}
              style={styles.addBtn}
            />
          </View>
        ) : null}

        {result?.status === 'RESOLVED' && candidate ? (
          <GlassCard style={styles.resultCard}>
            <PlacePhoto
              placeId={candidate.googlePlaceId ?? url}
              name={candidate.name}
              uri={null}
              style={styles.resultImage}
            />
            <View style={styles.resultBody}>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeLabel}>{t('placeImport.verifiedBadge')}</Text>
              </View>
              <Text style={styles.placeName}>{candidate.name}</Text>
              <Text style={styles.placeAddress}>{candidate.address}</Text>

              {candidate.googleRating != null ? (
                <Text style={styles.placeReviews}>
                  {t('placeImport.reviews', {
                    rating: candidate.googleRating,
                    n: (candidate.googleRatingCount ?? 0).toLocaleString(i18n.language),
                  })}
                </Text>
              ) : null}

              {/* Google's business status is a fact worth surfacing: submitting a
                  closed place wastes a moderator's time and the user's. */}
              {candidate.businessStatus && candidate.businessStatus !== 'OPERATIONAL' ? (
                <Text style={styles.warning}>
                  {t(`placeImport.businessStatus.${candidate.businessStatus}`, {
                    defaultValue: t('placeImport.businessStatusUnknown'),
                  })}
                </Text>
              ) : null}

              {submit.isSuccess ? (
                <Text style={styles.addedLabel}>
                  {submit.data?.status === 'ALREADY_EXISTS'
                    ? t('placeImport.existsBody')
                    : t('placeImport.pendingReview')}
                </Text>
              ) : (
                <PrimaryBtn
                  label={t('placeImport.submit')}
                  onPress={() => candidate.googlePlaceId && onSubmitPlace(candidate.googlePlaceId)}
                  loading={submit.isPending}
                  disabled={!candidate.googlePlaceId}
                  style={styles.addBtn}
                />
              )}

              {submit.isError ? <Text style={styles.errorLabel}>{t('placeImport.submitFailed')}</Text> : null}

              {/* Provider data must be shown with its attribution. */}
              {(candidate.attributions ?? []).map(attribution => (
                <Text key={attribution} style={styles.attribution}>
                  {attribution}
                </Text>
              ))}
            </View>
          </GlassCard>
        ) : null}

        {result?.status === 'UNRESOLVED' ? (
          <View style={styles.rejectedCard}>
            <Text style={styles.rejectedTitle}>{t('placeImport.rejectedTitle')}</Text>
            <Text style={styles.rejectedReason}>
              {t(`placeImport.reason.${result.reasonCodes?.[0] ?? 'NOT_FOUND'}`, {
                defaultValue: t('placeImport.reason.NOT_FOUND'),
              })}
            </Text>
            <GhostBtn label={t('placeImport.tryAgain')} onPress={reset} />
          </View>
        ) : null}
      </ScrollView>
    </Atmosphere>
  )
}
