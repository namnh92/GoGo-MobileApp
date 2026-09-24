import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'

/**
 * "Now" for a screen that labels things by time (a plan whose date has passed).
 * Read once per focus rather than in render: render must stay pure, and a
 * screen is read when it comes back into view — including one showing a list
 * cached, offline, long before the time it is compared against.
 */
export function useFocusedNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now())
    }, []),
  )
  return now
}
