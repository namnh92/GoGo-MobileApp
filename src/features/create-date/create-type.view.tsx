import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { track } from '@/shared/analytics'
import { useRoom, useRoomStore, type RoomType } from '@/shared/store/roomStore'
import { haptic } from '@/shared/ui/feedback'
import { IconCheck } from '@/shared/ui/icons'
import { Atmosphere, BackHeader, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { colors, onDark, spacing } from '@/shared/ui/tokens'

import { WizardActions } from './wizard-actions.view'
import { styles } from './create-type.style'

const nameSchema = z.object({ title: z.string().trim().max(80) })

const options: {
  type: RoomType
  emoji: string
  titleKey: 'createType.couple' | 'createType.group'
  descKey: 'createType.coupleDesc' | 'createType.groupDesc'
}[] = [
  { type: 'couple', emoji: '❤️', titleKey: 'createType.couple', descKey: 'createType.coupleDesc' },
  { type: 'group', emoji: '👥', titleKey: 'createType.group', descKey: 'createType.groupDesc' },
]

export default function CreateTypeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomType, setAudience } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(nameSchema),
    defaultValues: { title: useRoomStore.getState().title },
  })

  /**
   * Tapping a card used to navigate immediately, which made the selected state
   * unreachable — you could never see which one you had picked, and a mis-tap
   * was a screen you had to back out of. Selection and commitment are now two
   * separate acts (spec §10).
   */
  const [selected, setSelected] = useState<RoomType | null>(roomType ?? null)

  function pick(type: RoomType) {
    haptic('select')
    setSelected(type)
    setAudience(type === 'group' ? 'group-host' : 'couple')
  }

  function next({ title }: z.infer<typeof nameSchema>) {
    patchDraft({ title })
    if (!selected) return
    track('room_type_selected', { type: selected })
    router.push(selected === 'group' ? '/create/group-setup' : '/create/location')
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<WizardActions step="type" />} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('createType.title')}</Text>
        <Text style={styles.nameLabel}>{t('createType.roomName')}</Text>
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              value={value}
              onChangeText={text => { onChange(text); patchDraft({ title: text }) }}
              onBlur={onBlur}
              maxLength={80}
              accessibilityLabel={t('createType.roomName')}
              placeholder={t('createType.roomNameHint')}
              style={styles.nameInput}
            />
          )}
        />
        <View style={{ gap: spacing[3], marginTop: spacing[7] }}>
          {options.map(option => {
            const active = selected === option.type
            return (
              <Pressable
                key={option.type}
                onPress={() => pick(option.type)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.option,
                  active ? styles.optionActive : glassStyles.card,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>
                    {t(option.titleKey)}
                  </Text>
                  <Text style={[styles.optionDesc, { color: active ? onDark.medium : colors.neutral[500] }]}>
                    {t(option.descKey)}
                  </Text>
                </View>
                {/* Selection is not colour alone. */}
                {active ? (
                  <View style={styles.check}>
                    <IconCheck color={colors.brand.coral} size={14} />
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[6] }]}>
        <PrimaryBtn label={t('common.continue')} onPress={handleSubmit(next)} disabled={!selected} />
      </View>
    </Atmosphere>
  )
}
