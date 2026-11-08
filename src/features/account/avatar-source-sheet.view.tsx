import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import type { MaterialIconName } from '@/shared/ui/material-icon'
import { SheetOptionList } from '@/shared/ui/sheet-option-list.view'
import { SecondaryBtn } from '@/shared/ui/button.view'
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
      <SheetOptionList options={options.map(option => ({
        key: option.source, icon: option.icon, title: t(`account.${option.title}`), body: t(`account.${option.body}`),
        destructive: option.source === 'remove', disabled: option.source !== 'remove' && !canUpload,
        onPress: () => onChoose(option.source),
      }))} />
      <SheetActions><SecondaryBtn variant="neutral" label={t('common.cancel')} onPress={onClose} /></SheetActions>
    </View>
  </Sheet>
}
