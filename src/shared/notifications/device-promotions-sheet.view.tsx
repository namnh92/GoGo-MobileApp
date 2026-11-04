import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GhostBtn, PrimaryBtn } from '@/shared/ui/button.view'
import { useReducedMotion } from '@/shared/ui/feedback'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './device-promotions-sheet.style'

/**
 * GoGo-MobileApp#398 (shape D6) — what a device with no account is told before it
 * holds an identity. A new wording bumps `DEVICE_PROMOTIONS_DISCLOSURE`.
 */
export function DevicePromotionsSheet({
  visible,
  requesting,
  onContinue,
  onDecline,
  onLater,
}: {
  visible: boolean
  /** The OS prompt is up: the primary button shows it is working. */
  requesting: boolean
  onContinue: () => void
  onDecline: () => void
  /** Back, or a tap outside: nothing answered, asked again next launch. */
  onLater: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onLater}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onLater}
          disabled={requesting}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text variant="title2" accessibilityRole="header">{t('devicePromotions.sheet.title')}</Text>
          <ScrollView style={styles.bodyScroll}>
            <Text variant="body" color="text.secondary">{t('devicePromotions.sheet.body')}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <PrimaryBtn label={t('devicePromotions.sheet.continue')} onPress={onContinue} loading={requesting} />
            <GhostBtn label={t('devicePromotions.sheet.decline')} onPress={onDecline} disabled={requesting} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
