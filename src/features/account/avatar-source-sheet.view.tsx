import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { MaterialIcon, type MaterialIconName } from '@/shared/ui/material-icon'
import type { AvatarSource } from '@/shared/media/pick-avatar'
import { styles } from './avatar-source-sheet.style'

export function AvatarSourceSheet({ visible, hasPhoto, canUpload, onClose, onClosed, onChoose }: {
  visible: boolean; hasPhoto: boolean; canUpload: boolean; onClose: () => void; onClosed: () => void
  onChoose: (source: AvatarSource | 'remove') => void
}) {
  const { t } = useTranslation()
  const options: { source: AvatarSource | 'remove'; icon: MaterialIconName; title: 'avatarCamera' | 'avatarLibrary' | 'avatarRemove'; body: 'avatarCameraBody' | 'avatarLibraryBody' | 'avatarRemoveBody' }[] = [
    { source: 'camera', icon: 'camera', title: 'avatarCamera', body: 'avatarCameraBody' },
    { source: 'library', icon: 'photoLibrary', title: 'avatarLibrary', body: 'avatarLibraryBody' },
    ...(hasPhoto ? [{ source: 'remove' as const, icon: 'trash' as const, title: 'avatarRemove' as const, body: 'avatarRemoveBody' as const }] : []),
  ]
  return <Sheet visible={visible} onClose={onClose} onClosed={onClosed} appearance="avatar" testID="avatar-source-sheet">
    <View style={styles.content}>
      <View style={styles.heading}><Text variant="savedWardTitle" accessibilityRole="header">{t('account.avatarEdit')}</Text>
        <Text variant="avatarSubtitle" color="text.secondary">{t('account.avatarSourceBody')}</Text></View>
      <View style={styles.group}>{options.map((option, index) => {
        const destructive = option.source === 'remove'
        const disabled = !destructive && !canUpload
        return <Pressable key={option.source} accessibilityRole="button" accessibilityLabel={t(`account.${option.title}`)}
          accessibilityState={{ disabled }} disabled={disabled} onPress={() => onChoose(option.source)}
          style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed, disabled && styles.disabled]}>
          <View style={[styles.icon, destructive && styles.dangerIcon]}><MaterialIcon name={option.icon} color={destructive ? 'status.dangerText' : 'accent.primary'} /></View>
          <View style={styles.copy}><Text variant="avatarAction" color={destructive ? 'status.dangerText' : 'text.primary'}>{t(`account.${option.title}`)}</Text>
            <Text variant="avatarCaption" color={destructive ? 'status.dangerText' : 'text.secondary'}>{t(`account.${option.body}`)}</Text></View>
          {!destructive ? <MaterialIcon name="chevronRight" size={16} color="text.secondary" /> : null}
        </Pressable>
      })}</View>
      <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
        <Text variant="avatarCancel">{t('common.cancel')}</Text>
      </Pressable>
    </View>
  </Sheet>
}
