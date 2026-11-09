import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, Keyboard, Modal, Platform, View } from 'react-native'
import { LoadingIndicator } from './loading-indicator.view'
import { styles } from './blocking-loading-overlay.style'
import { loadingIndicator } from './tokens'

const blockDismiss = () => {}

/** Blocks tabs, screen gestures and Android back as well as the form. Queue
 * any result sheet from onClosed so iOS finishes dismissing this modal first. */
export function BlockingLoadingOverlay({ visible, accessibilityLabel, onClosed }: {
  visible: boolean
  accessibilityLabel?: string
  onClosed?: () => void
}) {
  const { t } = useTranslation()
  const label = accessibilityLabel ?? t('common.loading')
  const wasVisible = useRef(false)
  const closed = useRef(onClosed)
  useEffect(() => { closed.current = onClosed }, [onClosed])
  useEffect(() => {
    if (visible) Keyboard.dismiss()
    if (wasVisible.current && !visible && Platform.OS !== 'ios') closed.current?.()
    wasVisible.current = visible
  }, [visible])
  return <Modal testID="blocking-loading-modal" visible={visible} transparent animationType="none"
    presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent
    allowSwipeDismissal={false} onRequestClose={blockDismiss}
    onShow={() => AccessibilityInfo.announceForAccessibility(label)}
    onDismiss={Platform.OS === 'ios' ? () => closed.current?.() : undefined}>
    <View testID="blocking-loading-overlay" style={styles.screen} accessible
      accessibilityViewIsModal accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityState={{ busy: true }} accessibilityLiveRegion="polite"
      onAccessibilityEscape={blockDismiss} onStartShouldSetResponder={() => true}>
      <LoadingIndicator variant="dark" decorative size={loadingIndicator.overlaySize} />
    </View>
  </Modal>
}

/** Delay result sheets until the submit modal has actually left its presenter. */
export function useSubmitOverlay(visible: boolean) {
  const [closed, setClosed] = useState(true)
  if (visible && closed) setClosed(false)
  return { closed, onClosed: () => setClosed(true) }
}
