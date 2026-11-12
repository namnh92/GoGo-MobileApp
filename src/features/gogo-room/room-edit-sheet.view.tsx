import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { AppHeader } from '@/shared/ui/app-header.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { Sheet, type SheetProps } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { styles } from './room-edit-sheet.style'

/** Presentation only: every editor keeps its own validation and mutation. */
export function RoomEditSheet({ label, value, children, onClose, pending = false, title = label, additionalRow, renderRows, scroll = true, size = 'content' }: {
  label: string
  value: string
  title?: string
  pending?: boolean
  /** Embedded administrative lists own their scrolling. */
  scroll?: boolean
  size?: SheetProps['size']
  /** A second summary row that opens this same sheet. */
  additionalRow?: (open: () => void) => ReactNode
  /** Arrange summary rows while retaining one shared editor sheet. */
  renderRows?: (row: ReactNode, open: () => void) => ReactNode
  onClose?: () => void
  children: (close: () => void) => ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const close = () => {
    // Header, backdrop, Android back, accessibility escape and editor cancel.
    if (pending) return
    setOpen(false)
    onClose?.()
  }
  const row = <View style={styles.conditionRow}>
    <View style={styles.flex}><Text variant="caption" color="text.secondary">{label}</Text><Text variant="body">{value}</Text></View>
    <GhostBtn size="small" label={t('roomLobby.edit')} accessibilityHint={label} onPress={() => setOpen(true)} />
  </View>
  return <>
    {renderRows ? renderRows(row, () => setOpen(true)) : row}
    {additionalRow?.(() => setOpen(true))}
    <Sheet visible={open} onClose={close} scroll={scroll} size={size} testID="room-edit-sheet" header={<AppHeader variant="sheet" safeArea={false} title={title} onBack={close} backDisabled={pending} />}>
      {open ? <View testID="room-edit-body" style={[styles.editorBody, size === 'full' && styles.fullBody]}>{children(close)}</View> : null}
    </Sheet>
  </>
}
