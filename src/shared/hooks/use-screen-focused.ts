import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'

/**
 * Whether this screen is the one on top. A navigation stack keeps the screens
 * behind the current one mounted, so "mounted" is not "visible" — a room
 * screen two levels down kept its poll cadence alive on top of the visible
 * one until this existed.
 *
 * Starts true: the first render of a screen is the one being navigated to.
 */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )
  return focused
}
