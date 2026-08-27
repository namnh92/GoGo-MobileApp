import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { Atmosphere, BackHeader, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './preference.style'

const MAX_PREFS = 3

export default function PreferenceScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const [selected, setSelected] = useState<string[]>([])

  function toggle(label: string) {
    setSelected(prev =>
      prev.includes(label) ? prev.filter(x => x !== label) : prev.length < MAX_PREFS ? [...prev, label] : prev,
    )
  }

  function complete() {
    track('preference_completed', { count: selected.length })
    router.push(`/room/${roomId}/swipe`)
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('preference.title')}</Text>
        <Text style={styles.body}>{t('preference.body')}</Text>

        <View style={styles.grid}>
          {content.prefOptions.map(p => {
            const active = selected.includes(p.label)
            return (
              <Pressable
                key={p.label}
                onPress={() => toggle(p.label)}
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                <Text style={[styles.optionLabel, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>{p.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn
          label={`${t('common.continue')}${selected.length > 0 ? ` (${selected.length})` : ''}`}
          onPress={complete}
        />
      </View>
    </Atmosphere>
  )
}
