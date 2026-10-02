import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { track } from '@/shared/analytics'
import { useRoom, useRoomStore, type RoomType } from '@/shared/store/roomStore'
import { haptic } from '@/shared/ui/feedback'
import { IconCheck } from '@/shared/ui/icons'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Atmosphere, BackHeader, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { Glyph, Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

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
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)
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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: footerInset + spacing[4] }]}>
        <Text variant="display" style={styles.title}>{t('createType.title')}</Text>
        <Text variant="label" style={styles.nameLabel}>{t('createType.roomName')}</Text>
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
                <Glyph size="md">{option.emoji}</Glyph>
                <View style={{ flex: 1 }}>
                  <Text variant="title2" color={active ? 'accent.onAccent' : 'text.primary'}>
                    {t(option.titleKey)}
                  </Text>
                  <Text variant="bodySmall" color={active ? 'onDark.medium' : 'text.secondary'} style={styles.optionDesc}>
                    {t(option.descKey)}
                  </Text>
                </View>
                {/* Selection is not colour alone. */}
                {active ? (
                  <View style={styles.check}>
                    <IconCheck color={theme.accent.primary} size={14} />
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
      <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
        <PrimaryBtn label={t('common.continue')} onPress={handleSubmit(next)} disabled={!selected} />
      </GlassBar>
    </Atmosphere>
  )
}
