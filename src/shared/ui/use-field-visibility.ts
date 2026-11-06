import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, type KeyboardEvent, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, View } from 'react-native'
import { useReducedMotionPreference } from './feedback'
import { spacing } from './tokens'

/** One screen-owned scroll and one KAV. All measurements use window coordinates. */
export function useFieldVisibility(identity: string) {
  const scroll = useRef<ScrollView>(null)
  const viewport = useRef<View>(null)
  const groups = useRef<Record<string, View | null>>({})
  const controls = useRef<Record<string, View | null>>({})
  const focus = useRef<string | null>(null)
  const offset = useRef(0)
  const keyboardTop = useRef(Infinity)
  const manuallyScrolling = useRef(false)
  const generation = useRef(0)
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const [helperLimits, setHelperLimits] = useState<Record<string, number>>({})
  const reduced = useReducedMotionPreference()
  const schedule = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    const ticket = ++generation.current
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const key = focus.current
      if (!key || manuallyScrolling.current) return
      viewport.current?.measureInWindow((_x, top, _w, height) => {
        if (height <= 0 || ticket !== generation.current) return
        const bottom = Math.min(top + height, keyboardTop.current) - spacing[2]
        const available = bottom - top
        groups.current[key]?.measureInWindow((_gx, y, _gw, groupHeight) => {
          controls.current[key]?.measureInWindow((_cx, _cy, _cw, controlHeight) => {
            if (ticket !== generation.current || focus.current !== key || available <= 0 || manuallyScrolling.current) return
            // Keep an already bounded helper stable while typing. Never shrink its font.
            if (groupHeight > available && available - controlHeight >= 44) {
              const limit = available - controlHeight - spacing[1]
              setHelperLimits(previous => previous[key] === limit ? previous : { ...previous, [key]: limit })
            }
            // An impossible whole-group fit prioritises the input. The helper is
            // scrollable when there is usable space, otherwise ordinary form scroll
            // and tap-outside/drag keyboard dismissal preserve reachability.
            const targetHeight = groupHeight > available ? controlHeight : groupHeight
            const delta = targetHeight > available || y < top ? y - top : Math.max(0, y + targetHeight - bottom)
            if (Math.abs(delta) > 0.5) scroll.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: reduced === false })
          })
        })
      })
    })
  }, [reduced])
  const cancelScheduled = useCallback(() => {
    generation.current++
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])
  useEffect(() => {
    focus.current = null
    manuallyScrolling.current = false
    return cancelScheduled
  }, [identity, cancelScheduled])
  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      keyboardTop.current = event.endCoordinates.screenY
      setHelperLimits({})
      schedule()
    }
    const subscriptions = [Keyboard.addListener('keyboardDidShow', update), Keyboard.addListener('keyboardDidChangeFrame', update), Keyboard.addListener('keyboardDidHide', () => {
      generation.current++
      keyboardTop.current = Infinity
      setHelperLimits({})
    })]
    return () => { subscriptions.forEach(subscription => subscription.remove()) }
  }, [schedule])
  return {
    scrollRef: scroll, viewportRef: viewport, schedule,
    resetHelpers: () => setHelperLimits({}),
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = event.nativeEvent.contentOffset.y },
    onScrollBeginDrag: () => { manuallyScrolling.current = true; generation.current++ },
    field: (key: string) => ({
      groupRef: (node: View | null) => { groups.current[key] = node },
      controlRef: (node: View | null) => { controls.current[key] = node },
      groupTestID: `auth-field-${key}`,
      onGroupLayout: schedule,
      helperMaxHeight: helperLimits[key],
      onFocus: () => { focus.current = key; manuallyScrolling.current = false; schedule() },
      onBlur: () => { if (focus.current === key) { focus.current = null; generation.current++ } },
    }),
  }
}
