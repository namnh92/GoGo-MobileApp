import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { AppHeader } from '@/shared/ui/app-header.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { Sheet, type SheetProps } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { RoomConditionConfirmation, useRoomConditionConfirmation, type ConfirmConditions } from './room-condition-confirmation.view'
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
  children: (close: () => void, confirmConditions: ConfirmConditions) => ReactNode
}) {
  const { t } = useTranslation()
  const confirmation = useRoomConditionConfirmation(true)
  const [open, setOpen] = useState(false)
  const close = () => {
    // Header, backdrop, Android back, accessibility escape and editor cancel.
    if (confirmation.visible) { confirmation.dismiss(); return }
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
    <Sheet visible={open} onClose={close} scroll={scroll} size={size} testID="room-edit-sheet" header={confirmation.visible ? undefined : <AppHeader variant="sheet" safeArea={false} title={title} onBack={close} backDisabled={pending} />}>
      {open ? <RoomConditionConfirmation.Provider value={confirmation.confirm}>
        <View accessibilityElementsHidden={confirmation.visible} importantForAccessibility={confirmation.visible ? 'no-hide-descendants' : 'auto'} style={[size === 'full' && styles.fullBody, confirmation.visible && styles.hidden]}>
          <View testID="room-edit-body" style={[styles.editorBody, size === 'full' && styles.fullBody]}>{children(close, confirmation.confirm)}</View>
        </View>
        {confirmation.sheet}
      </RoomConditionConfirmation.Provider> : null}
    </Sheet>
  </>
}
