import { StyleSheet } from 'react-native-unistyles'
import { onboardingSpacing } from './onboarding-layout'
const first = onboardingSpacing(0)
const swipe = onboardingSpacing(1)
const last = onboardingSpacing(2)
export const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  upperRegion: { flex: 1, minHeight: 0 },
  upper: { flex: 1, minHeight: 0 },
  header: { minHeight: 44, flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  headerSpaced: { marginVertical: swipe.header },
  headerSpace: { flex: 1 },
  back: { borderWidth: 0, backgroundColor: 'transparent' },
  visual: { flexShrink: 0, marginTop: first.visualTop },
  lastVisual: { marginTop: last.visualTop, marginBottom: last.visualBottom },
  narrative: { flexShrink: 0, alignItems: 'center', marginTop: first.narrative, paddingHorizontal: 4 },
  swipeNarrative: { marginTop: swipe.narrative, paddingHorizontal: 8 },
  title: { textAlign: 'center', letterSpacing: -0.56, marginBottom: 8 },
  body: { textAlign: 'center', maxWidth: 320 },
  dots: { flexShrink: 0, alignItems: 'center', marginTop: first.dotsTop, paddingVertical: 4 },
  swipeDots: { marginTop: swipe.dotsTop },
  lastDots: { flexShrink: 0, alignItems: 'center', marginTop: last.dotsTop, marginBottom: last.dotsBottom },
  actions: { flexShrink: 0, marginTop: first.actions },
  lastActions: { marginTop: last.actions, gap: 8 },
})
