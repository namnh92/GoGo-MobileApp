import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { track } from '@/shared/analytics'
import { useRoom, type RoomType } from '@/shared/store/roomStore'
import { Atmosphere, BackHeader, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './create-type.style'

const options: { type: RoomType; emoji: string; titleKey: 'createType.couple' | 'createType.group'; descKey: 'createType.coupleDesc' | 'createType.groupDesc' }[] = [
  { type: 'couple', emoji: '❤️', titleKey: 'createType.couple', descKey: 'createType.coupleDesc' },
  { type: 'group', emoji: '👥', titleKey: 'createType.group', descKey: 'createType.groupDesc' },
]

export default function CreateTypeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomType, setAudience } = useRoom()

  function pick(type: RoomType) {
    setAudience(type === 'group' ? 'group-host' : 'couple')
    track('room_type_selected', { type })
    router.push(type === 'group' ? '/create/group-setup' : '/create/location')
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('createType.title')}</Text>
        <View style={{ gap: spacing[3], marginTop: spacing[7] }}>
          {options.map(o => {
            const active = roomType === o.type
            return (
              <Pressable
                key={o.type}
                onPress={() => pick(o.type)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <Text style={styles.optionEmoji}>{o.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>{t(o.titleKey)}</Text>
                  <Text style={[styles.optionDesc, { color: active ? 'rgba(255,255,255,0.8)' : colors.neutral[500] }]}>{t(o.descKey)}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
    </Atmosphere>
  )
}
