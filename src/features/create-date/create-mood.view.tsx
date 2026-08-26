import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { INVITE_CODE } from '@/data/mockData'
import { useRoom } from '@/shared/store/roomStore'
import type { Mood } from '@/data/types'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { Atmosphere, BackHeader, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './create-mood.style'

const MAX_MOODS = 3
const MAX_SETTINGS = 2

function ChipGrid({ options, selected, onToggle, cols = 2 }: {
  options: Mood[]
  selected: string[]
  onToggle: (label: string) => void
  cols?: number
}) {
  // cols=3 rows (short labels) auto-size so text never truncates.
  const sizing = cols === 3 ? styles.chipAuto : { width: '48%' as const }
  return (
    <View style={styles.grid}>
      {options.map(o => {
        const active = selected.includes(o.label)
        return (
          <Pressable
            key={o.label}
            onPress={() => onToggle(o.label)}
            accessibilityState={{ selected: active }}
            style={[styles.chip, sizing, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
          >
            <Text style={{ fontSize: 20 }}>{o.emoji}</Text>
            <Text style={[styles.chipLabel, { color: active ? colors.neutral[0] : colors.neutral[900] }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function CreateMoodScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const [moods, setMoods] = useState<string[]>(['Romantic', 'Creative'])
  const [settings, setSettings] = useState<string[]>([])
  const [spending, setSpending] = useState<string>(content.spendingStyles[1].label)
  const { seedPlaces, removeSeedPlace } = useRoom()

  function toggleCapped(setter: React.Dispatch<React.SetStateAction<string[]>>, max: number) {
    return (label: string) =>
      setter(prev => (prev.includes(label) ? prev.filter(x => x !== label) : prev.length < max ? [...prev, label] : prev))
  }

  function createRoom() {
    track('date_context_completed', { moods: moods.join(','), settings: settings.join(','), spending })
    track('gogo_room_created')
    router.push(`/room/${INVITE_CODE}`)
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<Text style={styles.stepLabel}>4 / 4</Text>} />
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <ProgressDots total={4} current={3} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <Text style={styles.title}>{t('createMood.title')}</Text>
        <Text style={styles.body}>{t('createMood.body', { max: MAX_MOODS })}</Text>

        <ChipGrid options={content.moods} selected={moods} onToggle={toggleCapped(setMoods, MAX_MOODS)} />

        <Text style={styles.sectionTitle}>{t('createMood.settingTitle')}</Text>
        <ChipGrid options={content.settings} selected={settings} onToggle={toggleCapped(setSettings, MAX_SETTINGS)} />

        <Text style={styles.sectionTitle}>{t('createMood.spendingTitle')}</Text>
        <ChipGrid options={content.spendingStyles} selected={[spending]} onToggle={setSpending} cols={3} />

        <Text style={styles.sectionTitle}>{t('createMood.seedTitle')}</Text>
        <Text style={styles.seedHint}>{t('createMood.seedHint')}</Text>
        <View style={styles.seedRow}>
          {seedPlaces.map(place => (
            <Pressable
              key={place.title}
              onPress={() => removeSeedPlace(place.title)}
              accessibilityLabel={`${place.title} ✕`}
              style={styles.seedChip}
            >
              <Text style={styles.seedChipLabel}>{place.category} {place.title}  ✕</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/places/search?picker=1')} style={styles.seedAddBtn}>
            <Text style={styles.seedAddLabel}>{t('createMood.addPlace')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('createMood.cta')} onPress={createRoom} />
      </View>
    </Atmosphere>
  )
}
