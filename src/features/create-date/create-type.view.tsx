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
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { useFieldVisibility } from '@/shared/ui/use-field-visibility'

import { CreateLocationFields } from './create-location-fields.view'
import { useCreateLocation } from './use-create-location'

import { WizardScreen } from './wizard-step.view'
import { WizardStepHeader } from './wizard-step-header.view'
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
  const { viewportRef, scrollRef, schedule, onScroll, onScrollBeginDrag, field } = useFieldVisibility('create-type')
  const { groupRef, controlRef, onGroupLayout, onFocus, onBlur: blurName } = field('room-name')
  const { roomType, setAudience } = useRoom()
  const location = useCreateLocation()
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
    if (!selected || !location.validate()) return
    track('room_type_selected', { type: selected })
    router.push(selected === 'group' ? '/create/group-setup' : '/create/time')
  }

  return (
    <WizardScreen avoidKeyboard step="type">
      <View ref={viewportRef} testID="create-type-viewport" style={styles.fill} onLayout={schedule}>
        <ScrollView ref={scrollRef} testID="create-type-scroll" style={styles.fill}
          onLayout={schedule} onContentSizeChange={schedule}
          onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag} scrollEventThrottle={16}
          keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <WizardStepHeader title={t('createType.title')} subtitle={t('createType.body')} />
          <View style={styles.options} accessibilityRole="radiogroup">
            {options.map(option => {
              const active = selected === option.type
              return (
                <Pressable key={option.type} onPress={() => pick(option.type)} accessibilityRole="radio"
                  accessibilityState={{ selected: active }} style={[styles.option, active && styles.optionActive]}>
                  <View style={[styles.iconTile, active && styles.iconTileActive]}>
                    <Icon name={option.icon} size={28} color={active ? 'accent.onAccent' : 'text.secondary'} />
                  </View>
                  <View style={styles.optionBody}>
                    <Text variant={active ? 'discoveryHeading' : 'introHeading'} color={active ? 'accent.onSoft' : 'text.primary'}>
                      {t(option.titleKey)}
                    </Text>
                    <Text variant="bodySmall" color="text.secondary" style={styles.optionDesc}>{t(option.descKey)}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
          <View ref={groupRef} testID="create-room-name-group" onLayout={onGroupLayout} collapsable={false}>
            <View style={styles.nameLabelRow}>
              <Text variant="label">{t('createType.roomName')}</Text>
              <Text variant="caption" color="text.secondary">{`${title.length}/80`}</Text>
            </View>
            <View ref={controlRef} collapsable={false}>
              <Controller control={control} name="title"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput value={value} onChangeText={text => { onChange(text); patchDraft({ title: text }) }}
                    onFocus={onFocus} onBlur={() => { onBlur(); blurName() }} maxLength={80}
                    accessibilityLabel={t('createType.roomName')} placeholder={t('createType.roomNameHint')}
                    placeholderTextColor={theme.text.secondary} style={styles.nameInput} />
                )} />
            </View>
          </View>
          <CreateLocationFields model={location} />
        </ScrollView>
      </View>
      <GlassBar placement="docked" testID="create-footer">
        <PrimaryBtn variant="stitch" label={t('common.continue')} onPress={handleSubmit(next)} disabled={!selected} icon="arrowRight" />
      </GlassBar>
    </WizardScreen>
  )
}
