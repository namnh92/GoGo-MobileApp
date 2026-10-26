import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { Modal, Pressable, View } from 'react-native'

import { DangerBtn, GhostBtn, PrimaryBtn } from '@/shared/ui/button.view'
import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { Text } from '@/shared/ui/text'

import { styles } from './dialog.style'

/**
 * `cancel` backs out and is what the backdrop, Android back and the VoiceOver
 * escape gesture mean; `destructive` is the consequence the dialog asks about;
 * `default` is any other way forward.
 */
export type DialogActionStyle = 'default' | 'cancel' | 'destructive'

export interface DialogAction {
  key: string
  label: string
  style?: DialogActionStyle
}

export interface DialogOptions {
  title: string
  message?: string
  actions: DialogAction[]
}

export interface DialogProps extends DialogOptions {
  visible: boolean
  onAction: (key: string) => void
  /** Dismissed without choosing: backdrop, back, escape. Only offered when there is a `cancel` action. */
  onDismiss: () => void
}

/**
 * In-app confirmation (GoGo-MobileApp#381), for the questions whose answer has
 * consequences — delete a draft, cancel a room, replace a guest session.
 * `Alert.alert` drew those in the platform's own style, outside the button
 * family, and could not be exercised by pressing what a person presses.
 *
 * Buttons come from `button.view`: `destructive` → `DangerBtn`, `default` →
 * `PrimaryBtn`, `cancel` → `GhostBtn`, cancel last so a thumb resting at the
 * bottom of the stack lands on the harmless one. Every one is ≥ 44pt.
 *
 * The card is the accessibility modal; the title is its header, so VoiceOver
 * and TalkBack start there. It fades (no movement), and with reduced motion it
 * simply appears.
 */
export function Dialog({ visible, title, message, actions, onAction, onDismiss }: DialogProps) {
  const reduced = useReducedMotionPreference() ?? true
  const cancellable = actions.some(action => action.style === 'cancel')
  const dismiss = () => {
    if (cancellable) onDismiss()
  }
  const ordered = [
    ...actions.filter(action => action.style !== 'cancel'),
    ...actions.filter(action => action.style === 'cancel'),
  ]

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        {/* The card is the modal for screen readers; its cancel button is the way out. */}
        <Pressable
          style={styles.backdrop}
          onPress={dismiss}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={styles.card} accessibilityViewIsModal onAccessibilityEscape={dismiss}>
          <Text variant="title2" accessibilityRole="header">{title}</Text>
          {message ? <Text variant="body" color="text.secondary">{message}</Text> : null}
          <View style={styles.actions}>
            {ordered.map(action => {
              const Button = action.style === 'destructive' ? DangerBtn : action.style === 'cancel' ? GhostBtn : PrimaryBtn
              return <Button key={action.key} label={action.label} onPress={() => onAction(action.key)} />
            })}
          </View>
        </View>
      </View>
    </Modal>
  )
}

/**
 * A confirmation a handler can `await`, the way `Alert.alert` was used:
 *
 *   const { confirm, dialog } = useDialog()
 *   if ((await confirm({ title, actions })) === 'delete') …
 *   return <>…{dialog}</>
 *
 * Resolves with the pressed action's key, or `null` when dismissed. Opening a
 * second one dismisses the first. Unmounting with one open resolves it `null`,
 * so no awaiting handler is left hanging.
 */
export function useDialog(): { confirm: (options: DialogOptions) => Promise<string | null>; dialog: ReactElement | null } {
  const [options, setOptions] = useState<DialogOptions | null>(null)
  const resolver = useRef<((key: string | null) => void) | null>(null)

  const settle = useCallback((key: string | null) => {
    const resolve = resolver.current
    resolver.current = null
    setOptions(null)
    resolve?.(key)
  }, [])

  const confirm = useCallback((next: DialogOptions) => {
    resolver.current?.(null)
    return new Promise<string | null>(resolve => {
      resolver.current = resolve
      setOptions(next)
    })
  }, [])

  useEffect(() => () => resolver.current?.(null), [])

  const dialog = options ? (
    <Dialog visible {...options} onAction={settle} onDismiss={() => settle(null)} />
  ) : null

  return { confirm, dialog }
}
