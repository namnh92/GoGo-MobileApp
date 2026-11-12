import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { AppHeader } from '@/shared/ui/app-header.view'
import { Sheet, type SheetProps } from '@/shared/ui/sheet.view'
import { RoomConditionConfirmation, useRoomConditionConfirmation, type ConfirmConditions } from './room-condition-confirmation.view'
import { styles } from './room-edit-sheet.style'

/** One trigger and one native sheet; the unified editor owns its draft. */
export function RoomEditSheet({ title, children, onClose, pending = false, renderSummary, size = 'content' }: {
  title: string
  pending?: boolean
  size?: SheetProps['size']
  renderSummary: (open: () => void) => ReactNode
  onClose?: () => void
  children: (close: () => void, confirmConditions: ConfirmConditions) => ReactNode
}) {
  const confirmation = useRoomConditionConfirmation(true)
  const [open, setOpen] = useState(false)
  const close = () => {
    // Header, backdrop, Android back, accessibility escape and editor cancel.
    if (confirmation.visible) { confirmation.dismiss(); return }
    if (pending) return
    setOpen(false)
    onClose?.()
  }
  return <>
    {renderSummary(() => setOpen(true))}
    <Sheet visible={open} onClose={close} scroll={false} size={size} testID="room-edit-sheet" header={confirmation.visible ? undefined : <AppHeader variant="sheet" safeArea={false} title={title} onBack={close} backDisabled={pending} />}>
      {open ? <RoomConditionConfirmation.Provider value={confirmation.confirm}>
        <View accessibilityElementsHidden={confirmation.visible} importantForAccessibility={confirmation.visible ? 'no-hide-descendants' : 'auto'} style={[styles.shrink, size === 'full' && styles.fullBody, confirmation.visible && styles.hidden]}>
          <View testID="room-edit-body" style={[styles.editorBody, styles.shrink, size === 'full' && styles.fullBody]}>{children(close, confirmation.confirm)}</View>
        </View>
        {confirmation.sheet}
      </RoomConditionConfirmation.Provider> : null}
    </Sheet>
  </>
}
