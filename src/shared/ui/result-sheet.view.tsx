import { useEffect, useRef, type ReactNode, type ComponentRef } from 'react'
import { AccessibilityInfo, findNodeHandle, View } from 'react-native'
import { Icon, type IconName } from './icons'
import { DangerBtn, PrimaryBtn, SecondaryBtn } from './button.view'
import { Sheet } from './sheet.view'
import { Text, type TextColor } from './text'
import { useReducedMotionPreference } from './feedback'
import { motion, spacing } from './tokens'
import { styles } from './result-sheet.style'

type Action = { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }
export interface ResultSheetProps {
  visible: boolean
  variant: 'success' | 'error' | 'warning' | 'info'
  icon?: IconName
  title: string
  body: string
  /** Optional result context, rendered above the message. */
  media?: ReactNode
  note?: string
  primaryAction: Action & { destructive?: boolean }
  actionOrder?: 'primary-first' | 'secondary-first'
  testID?: string
  secondaryAction?: Action
  onClose: () => void
  onClosed?: () => void
}
const tones: Record<ResultSheetProps['variant'], TextColor> = {
  success: 'status.successText', error: 'status.dangerText', warning: 'status.warningText', info: 'status.infoText',
}
const icons: Record<ResultSheetProps['variant'], IconName> = {
  success: 'checkCircle', error: 'alert', warning: 'alert', info: 'info',
}

/** App-wide result feedback. Sheet owns modal lifecycle, animation and reduced motion. */
export function ResultSheet({ visible, variant, icon, title, body, media, note, primaryAction, secondaryAction, actionOrder = 'primary-first', testID = 'result-sheet', onClose, onClosed }: ResultSheetProps) {
  const titleRef = useRef<ComponentRef<typeof Text>>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reduced = useReducedMotionPreference()
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { if (!visible) clearTimeout(timer.current) }, [visible])
  const PrimaryAction = primaryAction.destructive ? DangerBtn : PrimaryBtn
  const secondary = secondaryAction ? <SecondaryBtn {...secondaryAction} style={styles.action} wrapLabel /> : null
  return (
    <Sheet visible={visible} onClose={onClose} onClosed={onClosed} testID={testID}
      footer={<View style={styles.actions}>
        {actionOrder === 'secondary-first' ? secondary : null}
        <PrimaryAction {...primaryAction} style={styles.action} wrapLabel />
        {actionOrder === 'primary-first' ? secondary : null}
      </View>}>
      <View style={styles.content}>
        <Icon name={icon ?? icons[variant]} color={tones[variant]} size={spacing[8]} />
        <Text ref={titleRef} accessibilityRole="header" variant="title1" style={styles.copy}
          onLayout={() => {
            clearTimeout(timer.current)
            timer.current = setTimeout(() => {
              if (!visible) return
              const node = findNodeHandle(titleRef.current)
              if (node != null) AccessibilityInfo.setAccessibilityFocus(node)
              AccessibilityInfo.announceForAccessibility([title, body, note].filter(Boolean).join('. '))
            }, reduced ? 0 : motion.standard)
          }}>{title}</Text>
        {media}
        <Text style={styles.copy}>{body}</Text>
        {note ? <Text variant="caption" color="text.secondary" style={styles.copy}>{note}</Text> : null}
      </View>
    </Sheet>
  )
}
