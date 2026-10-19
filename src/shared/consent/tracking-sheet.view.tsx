import { useTranslation } from 'react-i18next'
import { Modal, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GhostBtn, PrimaryBtn } from '@/shared/ui/button.view'
import { useReducedMotion } from '@/shared/ui/feedback'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './tracking-sheet.style'

/**
 * GoGo-MobileApp#366 — said before iOS asks. The words are the owner's
 * (#366, 2026-10-19). It never looks like the system dialog and offers nothing
 * in return for "Allow" (App Review 5.1.1/5.1.2): "Để sau" closes it and every
 * feature keeps working.
 */
export function TrackingSheet({ visible, requesting, onContinue, onLater }: {
  visible: boolean
  /** The system dialog is up: the primary button shows it is working. */
  requesting: boolean
  onContinue: () => void
  onLater: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onLater}
    >
      <View style={styles.modalRoot}>
        {/* A tap outside is "Để sau" for sighted users; screen readers get
            the button itself, not a second unlabelled copy of it. */}
        <Pressable
          style={styles.backdrop}
          onPress={onLater}
          disabled={requesting}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <Text variant="title2" accessibilityRole="header">{t('consent.tracking.title')}</Text>
          <Text variant="body" color="text.secondary">{t('consent.tracking.body')}</Text>
          <View style={styles.actions}>
            <PrimaryBtn
              label={t('consent.tracking.continue')}
              onPress={onContinue}
              loading={requesting}
            />
            <GhostBtn label={t('consent.tracking.later')} onPress={onLater} disabled={requesting} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
