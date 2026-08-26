import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AREAS } from '@/data/mockData'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { IconCheck, IconMapPin, IconSearch } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './create-location.style'

const CURRENT_AREA = 'Thảo Điền, TP.HCM'
const radii = ['2 km', '5 km', '10 km', 'Anywhere']

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export default function CreateLocationScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { area, setArea } = useRoom()
  const params = useLocalSearchParams<{ picker?: string }>()
  const [radiusChoice, setRadiusChoice] = useState('5 km')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [areaQuery, setAreaQuery] = useState('')

  // Demo/deep-link: ?picker=1 opens the area sheet (delay avoids modal present race).
  useEffect(() => {
    if (params.picker === '1') {
      const timer = setTimeout(() => setPickerOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [params.picker])
  const usingCurrent = area === CURRENT_AREA

  const needle = normalize(areaQuery.trim())
  const areaResults = AREAS.filter(a => !needle || normalize(a).includes(needle))

  function pickArea(value: string) {
    setArea(value)
    setPickerOpen(false)
    setAreaQuery('')
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
        <Pressable onPress={() => pickArea(CURRENT_AREA)} accessibilityRole="radio" accessibilityState={{ selected: usingCurrent }}>
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
          {radii.map(r => {
            const active = radiusChoice === r
            return (
              <Pressable
                key={r}
                onPress={() => setRadiusChoice(r)}
                accessibilityState={{ selected: active }}
                style={[styles.radiusBtn, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <Text style={[styles.radiusLabel, { color: active ? colors.neutral[0] : colors.neutral[500] }]}>{r}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/time')} />
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
              style={styles.sheetInput}
            />
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing[5] }}>
              {areaResults.map(a => {
                const active = a === area
                return (
                  <Pressable
                    key={a}
                    onPress={() => pickArea(a)}
                    accessibilityState={{ selected: active }}
                    style={styles.areaRow}
                  >
                    <Text style={[styles.areaLabel, active && { color: colors.brand.coral, fontWeight: '700' }]}>{a}</Text>
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
