import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { AppHeader } from '@/shared/ui/app-header.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { styles } from './room-edit-sheet.style'

/** Presentation only: every editor keeps its own validation and mutation. */
export function RoomEditSheet({ label, value, children, onClose }: { label: string; value: string; onClose?: () => void; children: (close: () => void) => ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const close = () => { setOpen(false); onClose?.() }
  return <>
    <View style={styles.conditionRow}>
      <View style={styles.flex}><Text variant="caption" color="text.secondary">{label}</Text><Text variant="body">{value}</Text></View>
      <GhostBtn size="small" label={t('roomLobby.edit')} accessibilityHint={label} onPress={() => setOpen(true)} />
    </View>
    <Sheet visible={open} onClose={close} testID="room-edit-sheet" header={<AppHeader variant="sheet" safeArea={false} title={label} onBack={close} />}>
      {open ? children(close) : null}
    </Sheet>
  </>
}
