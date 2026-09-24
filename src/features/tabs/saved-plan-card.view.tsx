import { useTranslation } from 'react-i18next'
import { Pressable, Text as RNText, View } from 'react-native'

import type { Plan } from '@/shared/api'
import { Card, GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'

import { styles } from './saved-plan-card.style'

/**
 * A saved plan in the Saved list. Its warnings say what is wrong in words, not
 * by colour alone; a plan that can no longer be read stays removable.
 */
export function SavedPlanCard({ plan, onOpen, onRemove }: { plan?: Plan; onOpen: () => void; onRemove: () => void }) {
  const { t } = useTranslation()
  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !plan }}
        disabled={!plan}
        onPress={onOpen}
        style={styles.body}
      >
        <RNText style={styles.glyph}>🗓️</RNText>
        <View style={styles.text}>
          <Text variant="title2">{t('saved.plan.title')}</Text>
          <Text variant="bodySmall" color="text.secondary">
            {plan ? t('saved.plan.stops', { n: plan.stops?.length ?? 0 }) : t('saved.plan.missing')}
          </Text>
          {plan?.isStale ? <Text variant="bodySmall" color="status.warningText">⚠️ {t('saved.plan.stale')}</Text> : null}
          {plan?.hasUnavailableStops ? <Text variant="bodySmall" color="status.warningText">⚠️ {t('saved.plan.unavailable')}</Text> : null}
        </View>
      </Pressable>
      <GhostBtn label={t('saved.remove')} onPress={onRemove} />
    </Card>
  )
}
