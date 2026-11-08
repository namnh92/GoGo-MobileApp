import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { View } from 'react-native'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/button.view'
import { IconChip } from '@/shared/ui/icon-chip.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import type { AvatarSource } from './pick-avatar'
import { styles } from './media-permission-sheet.style'

export type MediaPermissionIssue = { source: AvatarSource; status: 'denied' | 'unavailable' }

/** One permission/recovery pattern for camera and library, after system access fails. */
export function MediaPermissionSheet({ issue, onSettings, onChoose, onClose, onClosed }: {
  issue: MediaPermissionIssue | null
  onSettings: () => void
  onChoose: (source: AvatarSource) => void
  onClose: () => void
  onClosed: () => void
}) {
  const { t } = useTranslation()
  // Keep the last copy during the shared Sheet's exit animation.
  const [lastIssue, setLastIssue] = useState(issue)
  if (issue && issue !== lastIssue) setLastIssue(issue)
  const current = issue ?? lastIssue
  const source = current?.source ?? 'camera'
  const reason = current?.status === 'denied' ? 'Denied' : 'Unavailable'
  const settings = current?.status === 'denied'
  const fallback = source === 'camera' ? 'library' : 'camera'
  const fallbackLabel = t(fallback === 'library' ? 'account.avatarLibrary' : 'account.avatarCamera')
  return <Sheet visible={issue !== null} appearance="avatar" testID="media-permission-sheet" onClose={onClose} onClosed={onClosed}
    footer={<View style={styles.actions}>
      {settings ? <PrimaryBtn variant="stitch" label={t('account.avatarSettings')} onPress={onSettings} /> : null}
      {settings
        ? <SecondaryBtn variant="neutral" label={fallbackLabel} onPress={() => onChoose(fallback)} />
        : <PrimaryBtn variant="stitch" label={fallbackLabel} onPress={() => onChoose(fallback)} />}
      <SecondaryBtn variant="neutral" label={t('common.cancel')} onPress={onClose} />
    </View>}>
    <View style={styles.content}>
      <IconChip icon={source === 'camera' ? 'camera' : 'photoLibrary'} />
      <Text accessibilityRole="header" variant="savedWardTitle" style={styles.copy}>{t(`mediaPermission.${source}${reason}Title`)}</Text>
      <Text variant="bodySmall" color="text.secondary" style={styles.copy}>{t(`mediaPermission.${source}${reason}Body`)}</Text>
    </View>
  </Sheet>
}
