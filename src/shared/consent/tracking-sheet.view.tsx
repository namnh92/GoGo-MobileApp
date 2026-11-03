import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GhostBtn, PrimaryBtn } from '@/shared/ui/button.view'
import { useReducedMotion } from '@/shared/ui/feedback'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './tracking-sheet.style'

type TrackingSheetProps = {
  visible: boolean
  /** Back, or a tap outside: nothing answered, asked again next launch. */
  onLater: () => void
} & (
  | {
      /** iOS: said before the system dialog asks. */
      variant: 'system'
      /** The system dialog is up: the primary button shows it is working. */
      requesting: boolean
      onContinue: () => void
    }
  | {
      /** Android: no system dialog follows, so this sheet is the consent (#370). */
      variant: 'app'
      onAllow: () => void
      onDeny: () => void
    }
)

/**
 * GoGo-MobileApp#366 — said before iOS asks. The words are the owner's
 * (#366, 2026-10-19). It never looks like the system dialog and offers nothing
 * in return for "Allow" (App Review 5.1.1/5.1.2): "Để sau" closes it and every
 * feature keeps working.
 *
 * #370 — on Android this sheet is the consent: no system dialog follows. #404 —
 * the same sentences as iOS (owner, 2026-11-03); the recipients and the full list
 * are in Settings → Quyền và dữ liệu. A new wording bumps `CONSENT_DISCLOSURE`.
 */
export function TrackingSheet(props: TrackingSheetProps) {
  const { visible, onLater } = props
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const requesting = props.variant === 'system' && props.requesting

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
          {props.variant === 'system' ? (
            <>
              <Text variant="title2" accessibilityRole="header">{t('consent.tracking.title')}</Text>
              <Text variant="body" color="text.secondary">{t('consent.tracking.body')}</Text>
              <View style={styles.actions}>
                <PrimaryBtn
                  label={t('consent.tracking.continue')}
                  onPress={props.onContinue}
                  loading={requesting}
                />
                <GhostBtn label={t('consent.tracking.later')} onPress={onLater} disabled={requesting} />
              </View>
            </>
          ) : (
            <>
              <Text variant="title2" accessibilityRole="header">{t('consent.tracking.android.title')}</Text>
              <ScrollView style={styles.bodyScroll}>
                <Text variant="body" color="text.secondary">{t('consent.tracking.android.body')}</Text>
              </ScrollView>
              <View style={styles.actions}>
                <PrimaryBtn label={t('consent.tracking.android.allow')} onPress={props.onAllow} />
                <GhostBtn label={t('consent.tracking.android.deny')} onPress={props.onDeny} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}
