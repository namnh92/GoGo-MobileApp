import { useMutation } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { unsplashUrl } from '@/data/mockData'
import { mockApi, type PlaceImportResult } from '@/shared/api/mock'
import { track } from '@/shared/analytics'
import { useImportStore } from '@/shared/store/importStore'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, RemoteImage } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './import.style'

// Accepted Google Maps link shapes (SRS FR-PLACE-001).
const mapsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(value => {
    try {
      const host = new URL(value).hostname.replace(/^www\./, '')
      return (
        host === 'maps.google.com' ||
        host === 'maps.app.goo.gl' ||
        host === 'goo.gl' ||
        (host === 'google.com' && new URL(value).pathname.startsWith('/maps')) ||
        host.endsWith('.google.com')
      )
    } catch {
      return false
    }
  })

const DEMO_URLS: Record<string, string> = {
  '1': 'https://maps.app.goo.gl/banhmi362',
  fail: 'https://maps.app.goo.gl/failcase',
}

export default function PlaceImportScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { demo } = useLocalSearchParams<{ demo?: string }>()
  const addImportedPlace = useImportStore(s => s.addImportedPlace)
  const demoUrl = demo ? DEMO_URLS[demo] : undefined
  const [url, setUrl] = useState(demoUrl ?? '')
  const [invalid, setInvalid] = useState(false)
  const [added, setAdded] = useState(false)

  const verify = useMutation({
    mutationFn: mockApi.verifyPlaceImport,
    onSuccess: (result: PlaceImportResult) => {
      if (result.status === 'verified') track('place_import_verified', { place: result.place?.name ?? '' })
      else track('place_import_rejected', { reason: result.reasonCode ?? '' })
    },
  })

  function submit(value: string) {
    setAdded(false)
    const parsed = mapsUrlSchema.safeParse(value)
    if (!parsed.success) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    track('place_import_submitted')
    verify.mutate(parsed.data)
  }

  // Demo/deep-link: gogo://places/import?demo=1 (verified) | demo=fail (rejected)
  useEffect(() => {
    if (demoUrl) {
      track('place_import_submitted')
      verify.mutate(demoUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoUrl])

  function addToSaved() {
    const place = verify.data?.place
    if (!place) return
    addImportedPlace({
      title: place.name,
      area: place.area,
      priceK: 0,
      distanceKm: 0,
      category: '📍',
      open: true,
      tags: ['Mới thêm'],
      score: place.rating.toFixed(1),
      img: place.img,
    })
    track('place_import_added', { place: place.name })
    setAdded(true)
  }

  function reset() {
    verify.reset()
    setUrl('')
    setAdded(false)
  }

  const result = verify.data

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}>
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
          style={[styles.input, invalid && styles.inputError]}
        />
        {invalid && <Text style={styles.errorLabel}>{t('placeImport.invalidUrl')}</Text>}

        {verify.isPending ? (
          <View style={styles.verifyingRow}>
            <ActivityIndicator color={colors.brand.coral} />
            <Text style={styles.verifyingLabel}>{t('placeImport.verifying')}</Text>
          </View>
        ) : (
          <PrimaryBtn label={t('placeImport.verify')} onPress={() => submit(url)} disabled={url.trim() === ''} style={styles.verifyBtn} />
        )}

        {result?.status === 'verified' && result.place && (
          <GlassCard style={styles.resultCard}>
            <RemoteImage uri={unsplashUrl(result.place.img, 600, 280)} style={styles.resultImage} />
            <View style={styles.resultBody}>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeLabel}>{t('placeImport.verifiedBadge')}</Text>
              </View>
              <Text style={styles.placeName}>{result.place.name}</Text>
              <Text style={styles.placeAddress}>{result.place.address}</Text>
              <Text style={styles.placeReviews}>
                {t('placeImport.reviews', { rating: result.place.rating, n: result.place.reviewCount.toLocaleString('vi-VN') })}
              </Text>
              {added ? (
                <Text style={styles.addedLabel}>{t('placeImport.added')}</Text>
              ) : (
                <PrimaryBtn label={t('placeImport.addToSaved')} onPress={addToSaved} style={styles.addBtn} />
              )}
            </View>
          </GlassCard>
        )}

        {result?.status === 'rejected' && (
          <View style={styles.rejectedCard}>
            <Text style={styles.rejectedTitle}>{t('placeImport.rejectedTitle')}</Text>
            <Text style={styles.rejectedReason}>
              {t(`placeImport.reason.${result.reasonCode ?? 'NOT_FOUND'}`)}
            </Text>
            <Pressable onPress={reset} style={styles.tryAgain}>
              <Text style={styles.tryAgainLabel}>{t('placeImport.tryAgain')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Atmosphere>
  )
}
