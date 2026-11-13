import { useSyncExternalStore } from 'react'
import { AppState, Keyboard, Platform, type KeyboardEventName } from 'react-native'

/**
 * Whether the software keyboard is on screen (GoGo-MobileApp#381). Built on
 * React Native's own `Keyboard` events: `react-native-keyboard-controller`
 * would add a native module, which needs an ADR first.
 *
 * iOS sends `keyboardWill*` before the keyboard animates, so anything hidden
 * for it (the assistant float button, #379) leaves together with it. Android
 * only sends `keyboardDid*`.
 */
const SHOW: KeyboardEventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
const HIDE: KeyboardEventName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

let visible = Keyboard.isVisible()
const listeners = new Set<() => void>()

/** Recover missed Android events without overriding iOS's pre-animation state. */
export function syncAndroidKeyboardVisibility(): void {
  if (Platform.OS !== 'android') return
  const current = Keyboard.isVisible()
  if (current === visible) return
  visible = current
  listeners.forEach(onChange => onChange())
}

function subscribe(onChange: () => void): () => void {
  // Whatever happened while nobody listened, `isVisible` has caught up with
  // it. Only then: mid-animation on iOS it still says the previous state.
  if (listeners.size === 0) visible = Keyboard.isVisible()
  listeners.add(onChange)
  const shown = Keyboard.addListener(SHOW, () => {
    visible = true
    onChange()
  })
  const hidden = Keyboard.addListener(HIDE, () => {
    visible = false
    onChange()
  })
  const resumed = Platform.OS === 'android'
    ? AppState.addEventListener('change', state => {
      if (state === 'active') syncAndroidKeyboardVisibility()
    })
    : undefined
  return () => {
    listeners.delete(onChange)
    shown.remove()
    hidden.remove()
    resumed?.remove()
  }
}

const snapshot = () => visible

export function useKeyboardVisible(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
