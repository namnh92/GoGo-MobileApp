import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAreaAutocomplete } from '@/shared/api'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { IconCheck, IconMapPin, IconSearch } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './create-location.style'

const CURRENT_AREA = 'Thảo Điền, TP.HCM'
/** `null` means "anywhere" — the constraint simply omits `radiusM`. */
const RADIUS_OPTIONS: readonly (number | null)[] = [2000, 5000, 10000, null]
const DEBOUNCE_MS = 250

export default function CreateLocationScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { area, setArea } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const params = useLocalSearchParams<{ picker?: string }>()
  const [radiusM, setRadiusM] = useState<number | null>(5000)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [areaQuery, setAreaQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Demo/deep-link: ?picker=1 opens the area sheet (delay avoids modal present race).
  useEffect(() => {
    if (params.picker === '1') {
      const timer = setTimeout(() => setPickerOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [params.picker])

  // Debounce keystrokes so one autocomplete session is one provider call.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(areaQuery), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [areaQuery])

  const areas = useAreaAutocomplete(debouncedQuery, { enabled: pickerOpen })
  const predictions = areas.data?.predictions ?? []
  const usingCurrent = area === CURRENT_AREA

  function pickArea(prediction: { key?: string; description?: string; lat?: number; lng?: number }) {
    setArea(prediction.description ?? '')
    // The API constrains on the stable key and coordinates; the description is
    // display only (RULE-CORE-002).
    patchDraft({
      areaKey: prediction.key ?? null,
      originLat: prediction.lat ?? null,
      originLng: prediction.lng ?? null,
    })
    // Picking ends the billable autocomplete session.
    areas.endSession()
    setPickerOpen(false)
    setAreaQuery('')
    setDebouncedQuery('')
  }

  function next() {
    patchDraft({ radiusM })
    router.push('/create/time')
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<Text style={styles.stepLabel}>1 / 4</Text>} />
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <ProgressDots total={4} current={0} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('createLocation.title')}</Text>
        <Text style={styles.body}>{t('createLocation.body')}</Text>

        {/* Current location — tap to switch back */}
        <Pressable
          onPress={() => pickArea({ description: CURRENT_AREA })}
          accessibilityRole="radio"
          accessibilityState={{ selected: usingCurrent }}
        >
          <GlassCard style={styles.rowCard}>
            <View style={[styles.rowIcon, { backgroundColor: colors.brand.coralSoft }]}>
              <IconMapPin />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('createLocation.current')}</Text>
              <Text style={styles.rowSub}>{CURRENT_AREA}</Text>
            </View>
            {usingCurrent && <IconCheck />}
          </GlassCard>
        </Pressable>

        {/* Other area — opens the picker sheet */}
        <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button">
          <GlassCard style={styles.rowCard}>
            <View style={[styles.rowIcon, { backgroundColor: usingCurrent ? colors.neutral[100] : colors.brand.lavenderSoft }]}>
              <IconSearch />
            </View>
            <View style={{ flex: 1 }}>
              {usingCurrent ? (
                <Text style={[styles.rowTitle, { color: colors.neutral[500], fontWeight: '600' }]}>
                  {t('createLocation.searchOther')}
                </Text>
              ) : (
                <>
                  <Text style={styles.rowTitle}>{area}</Text>
                  <Text style={styles.rowSub}>{t('createLocation.searchOther')}</Text>
                </>
              )}
            </View>
            {!usingCurrent && <IconCheck />}
          </GlassCard>
        </Pressable>

        <Text style={styles.sectionTitle}>{t('createLocation.maxDistance')}</Text>
        <View style={styles.grid}>
          {RADIUS_OPTIONS.map(option => {
            const active = radiusM === option
            const label = option === null ? t('createLocation.anywhere') : `${option / 1000} km`
            return (
              <Pressable
                key={label}
                onPress={() => setRadiusM(option)}
                accessibilityState={{ selected: active }}
                style={[styles.radiusBtn, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <Text style={[styles.radiusLabel, { color: active ? colors.neutral[0] : colors.neutral[500] }]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={next} />
      </View>

      {/* Area picker sheet */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
          <View style={[styles.sheet, { maxHeight: '75%' }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('createLocation.pickArea')}</Text>
            <TextInput
              value={areaQuery}
              onChangeText={setAreaQuery}
              placeholder={t('createLocation.searchOther')}
              placeholderTextColor={colors.neutral[300]}
              autoCorrect={false}
              autoFocus
              style={styles.sheetInput}
            />
            {/* Provider results must carry their attribution; the static
                fallback list must not claim to come from the provider. */}
            <Text style={styles.poweredBy}>
              {areas.data?.attribution ?? t('createLocation.poweredBy')}
            </Text>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing[5] }}>
              {areas.isFetching && <ActivityIndicator color={colors.brand.coral} style={{ marginVertical: spacing[4] }} />}
              {areas.isError && !areas.isFetching && (
                <Text style={styles.noResults}>{t('common.errorBody')}</Text>
              )}
              {!areas.isFetching && !areas.isError && predictions.length === 0 && (
                <Text style={styles.noResults}>{t('createLocation.noResults')}</Text>
              )}
              {!areas.isFetching &&
                predictions.map(prediction => {
                  const active = prediction.description === area
                  return (
                    <Pressable
                      key={prediction.key ?? prediction.description}
                      onPress={() => pickArea(prediction)}
                      accessibilityState={{ selected: active }}
                      style={styles.areaRow}
                    >
                      <Text style={[styles.areaLabel, active && { color: colors.brand.coral, fontWeight: '700' }]}>
                        {prediction.description}
                      </Text>
                      {active && <IconCheck />}
                    </Pressable>
                  )
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Atmosphere>
  )
}
