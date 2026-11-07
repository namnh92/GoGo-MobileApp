import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

/** Opening facts must cross closing time and refresh immediately after resume. */
export function usePlaceClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const interval = setInterval(update, 30_000)
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update() })
    return () => { clearInterval(interval); subscription.remove() }
  }, [])
  return now
}
