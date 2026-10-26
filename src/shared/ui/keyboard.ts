import { useSyncExternalStore } from 'react'
import { Keyboard, Platform, type KeyboardEventName } from 'react-native'

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
let listeners = 0

function subscribe(onChange: () => void): () => void {
  // Whatever happened while nobody listened, `isVisible` has caught up with
  // it. Only then: mid-animation on iOS it still says the previous state.
  if (listeners === 0) visible = Keyboard.isVisible()
  listeners += 1
  const shown = Keyboard.addListener(SHOW, () => {
    visible = true
    onChange()
  })
  const hidden = Keyboard.addListener(HIDE, () => {
    visible = false
    onChange()
  })
  return () => {
    listeners -= 1
    shown.remove()
    hidden.remove()
  }
}

const snapshot = () => visible

export function useKeyboardVisible(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
