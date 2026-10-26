import { usePathname, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

import { isAssistantEntryOn } from '@/shared/config/features'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'
import {
  assistantCoachmarkDue,
  assistantIsNew,
  markAssistantIntroduced,
  noteAssistantHomeVisit,
  useAssistantIntroStore,
} from '@/shared/store/assistantIntroStore'
import { useBottomBarInset } from '@/shared/ui/bottom-bar-inset'
import { useKeyboardVisible } from '@/shared/ui/keyboard'

import { AssistantCoachmark } from './assistant-coachmark.view'
import { FAB_EDGE, FAB_GAP, FAB_SIZE, assistantHref, tabForPathname, useAssistantAccount, useAssistantFabStore } from './assistant-entry'
import { AssistantFab } from './assistant-fab.view'
import { styles } from './assistant-entry-layer.style'

/** Room the coachmark's arrow takes between the card and the button. */
const COACHMARK_LIFT = 14

/**
 * The float button and its Home introduction, drawn once over the four tabs
 * (GoGo-MobileApp#379). Mounted by the tabs layout, so it is not there on any
 * other route: place and plan detail, the create-plan steps and voting are all
 * pushed over the tabs, and pushing one — or opening GoGo AI itself — blurs
 * the tabs, which hides the button. It also leaves while the keyboard is up.
 * Behind the `assistantEntry` gate.
 */
export function AssistantEntryLayer() {
  if (!isAssistantEntryOn()) return null
  return <EntryLayer />
}

function EntryLayer() {
  const router = useRouter()
  const tab = tabForPathname(usePathname())
  const focused = useScreenFocused()
  const keyboardVisible = useKeyboardVisible()
  const barInset = useBottomBarInset()
  const account = useAssistantAccount()
  const intro = useAssistantIntroStore(state => (account ? state.accounts[account] : undefined))
  const collapsed = useAssistantFabStore(state => (tab ? state.collapsed[tab] : false))

  const onHome = focused && tab === 'home'
  useEffect(() => {
    if (onHome && account) noteAssistantHomeVisit(account)
  }, [onHome, account])

  if (!focused || !tab || keyboardVisible) return null

  const coachmark = tab === 'home' && account !== null && assistantCoachmarkDue(intro)
  const open = () => router.push(assistantHref())
  const fabBottom = barInset + FAB_GAP

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {coachmark ? (
        <AssistantCoachmark
          onTry={() => {
            markAssistantIntroduced(account)
            open()
          }}
          onDismiss={() => markAssistantIntroduced(account)}
          style={{ right: FAB_EDGE, bottom: fabBottom + FAB_SIZE + COACHMARK_LIFT }}
        />
      ) : null}
      <AssistantFab
        extended={!collapsed}
        isNew={account !== null && assistantIsNew(intro)}
        highlight={coachmark}
        onPress={open}
        style={{ right: FAB_EDGE, bottom: fabBottom }}
      />
    </View>
  )
}
