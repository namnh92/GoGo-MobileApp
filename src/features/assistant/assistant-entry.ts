import { useCallback, useMemo } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { create } from 'zustand'

import { useSession } from '@/shared/providers/session-provider'
import { isAssistantEntryOn } from '@/shared/config/features'
import { useBottomBarInset } from '@/shared/ui/bottom-bar-inset'
import { spacing } from '@/shared/ui/tokens'

/**
 * Geometry and shared state of the GoGo AI float button (GoGo-MobileApp#379,
 * design system `AssistantEntry variant="fab"`).
 */
export const FAB_SIZE = 56
/** From the right edge of the screen. */
export const FAB_EDGE = spacing[5]
/** Above the tab bar. */
export const FAB_GAP = spacing[4]
/** Scrolled further than this, the extended button collapses to its circle. */
export const FAB_COLLAPSE_AFTER = 24

export type AssistantTab = 'home' | 'plans' | 'saved' | 'profile'

/** The four tab screens carry the button; every other route hides it. */
export function tabForPathname(pathname: string): AssistantTab | null {
  switch (pathname) {
    case '/':
      return 'home'
    case '/plans':
      return 'plans'
    case '/saved':
      return 'saved'
    case '/profile':
      return 'profile'
    default:
      return null
  }
}

interface FabScrollState {
  /** Per tab, so switching tabs shows each one's own state. */
  collapsed: Record<AssistantTab, boolean>
  setCollapsed: (tab: AssistantTab, collapsed: boolean) => void
}

/** UI state only: whether each tab's list is scrolled past the collapse point. */
export const useAssistantFabStore = create<FabScrollState>()(set => ({
  collapsed: { home: false, plans: false, saved: false, profile: false },
  setCollapsed: (tab, collapsed) =>
    set(state => (state.collapsed[tab] === collapsed ? state : { collapsed: { ...state.collapsed, [tab]: collapsed } })),
}))

/**
 * What a tab screen's main scroll view needs for the float button: an
 * `onScroll` that collapses it after `FAB_COLLAPSE_AFTER` (and extends it again
 * at the top), and a bottom inset that lets the last item scroll clear of it —
 * tab bar + gap + button + the list's own breathing room. With the gate off
 * the inset is the one the screens had before.
 */
export function useAssistantFabScroll(tab: AssistantTab) {
  const barInset = useBottomBarInset()
  const on = isAssistantEntryOn()
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const collapsed = event.nativeEvent.contentOffset.y > FAB_COLLAPSE_AFTER
      // The store ignores a value it already holds, so this re-renders only
      // when the button changes shape.
      useAssistantFabStore.getState().setCollapsed(tab, collapsed)
    },
    [tab],
  )
  return useMemo(
    () => ({
      onScroll: on ? onScroll : undefined,
      scrollEventThrottle: 16,
      bottomInset: barInset + (on ? FAB_GAP + FAB_SIZE + spacing[4] : spacing[6]),
    }),
    [barInset, on, onScroll],
  )
}

/** The signed-in account the intro flags belong to; guests and signed-out people have none. */
export function useAssistantAccount(): string | null {
  const { session, status } = useSession()
  return status === 'user' ? (session?.userId ?? null) : null
}

export interface AssistantContext {
  placeId: string
  placeName: string
  /** A starter question tapped on the place card. */
  question?: string
}

/** Where GoGo AI opens, with what the person was looking at. */
export function assistantHref(context?: AssistantContext) {
  if (!context) return { pathname: '/assistant' as const }
  const params: Record<string, string> = { placeId: context.placeId, placeName: context.placeName }
  if (context.question) params.question = context.question
  return { pathname: '/assistant' as const, params }
}
