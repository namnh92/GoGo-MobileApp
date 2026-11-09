import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'

import { track } from '@/shared/analytics'
import { useRoom, useRoomStore, type RoomType } from '@/shared/store/roomStore'
import { haptic } from '@/shared/ui/feedback'
import { Icon, type IconName } from '@/shared/ui/icons'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Atmosphere, Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { WizardStep } from './wizard-step.view'
import { styles } from './create-type.style'

const nameSchema = z.object({ title: z.string().trim().max(80) })

const options: {
  type: RoomType
  icon: IconName
  titleKey: 'createType.couple' | 'createType.group'
  descKey: 'createType.coupleDesc' | 'createType.groupDesc'
}[] = [
  { type: 'couple', icon: 'heart', titleKey: 'createType.couple', descKey: 'createType.coupleDesc' },
  { type: 'group', icon: 'users', titleKey: 'createType.group', descKey: 'createType.groupDesc' },
]

export default function CreateTypeScreen() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)
  const { roomType, setAudience } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(nameSchema),
    defaultValues: { title: useRoomStore.getState().title },
  })

  const title = useRoomStore(state => state.title)

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
    <Atmosphere redesign>
      <WizardStep step="type" onBack={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: footerInset + spacing[4] }]}>
        <Text variant="introTitle" style={styles.title}>{t('createType.title')}</Text>
        <Text color="text.secondary" style={styles.body}>{t('createType.body')}</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {options.map(option => {
            const active = selected === option.type
            return (
              <Pressable
                key={option.type}
                onPress={() => pick(option.type)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={[styles.iconTile, active && styles.iconTileActive]}>
                  <Icon name={option.icon} size={28} color={active ? 'accent.onAccent' : 'text.secondary'} />
                </View>
                <View style={styles.optionBody}>
                  <View style={styles.optionHeading}>
                  <Text variant="discoveryHeading" color={active ? 'accent.onSoft' : 'text.primary'}>
                    {t(option.titleKey)}
                  </Text>
                  {active ? <Chip label={t('createType.selected')} variant="selected" appearance="soft" /> : null}
                  </View>
                  <Text variant="bodySmall" color="text.secondary" style={styles.optionDesc}>
                    {t(option.descKey)}
                  </Text>
                </View>

              </Pressable>
            )
          })}
        </View>
        <View style={styles.nameLabelRow}>
          <Text variant="label">{t('createType.roomName')}</Text>
          <Text variant="caption" color="text.secondary">{`${title.length}/80`}</Text>
        </View>
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
              placeholderTextColor={theme.text.secondary}
              style={styles.nameInput}
            />
          )}
        />
      </ScrollView>
      <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
        <PrimaryBtn variant="stitch" label={t('common.continue')} onPress={handleSubmit(next)} disabled={!selected} icon="arrowRight" />
      </GlassBar>
    </Atmosphere>
  )
}
