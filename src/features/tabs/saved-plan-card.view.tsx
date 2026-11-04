import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import type { Plan } from '@/shared/api'
import { Card, GhostBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
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
        <View style={styles.icon}>
          <Icon name="calendar" size={20} color="accent.onSoft" />
        </View>
        <View style={styles.text}>
          <Text variant="title2">{t('saved.plan.title')}</Text>
          <Text variant="bodySmall" color="text.secondary">
            {plan ? t('saved.plan.stops', { count: plan.stops?.length ?? 0 }) : t('saved.plan.missing')}
          </Text>
          {plan?.isStale ? <View style={styles.warning}>
              <Icon name="alert" size={14} color="status.warningText" />
              <Text variant="bodySmall" color="status.warningText" style={styles.warningText}>{t('saved.plan.stale')}</Text>
            </View> : null}
          {plan?.hasUnavailableStops ? <View style={styles.warning}>
              <Icon name="alert" size={14} color="status.warningText" />
              <Text variant="bodySmall" color="status.warningText" style={styles.warningText}>{t('saved.plan.unavailable')}</Text>
            </View> : null}
        </View>
      </Pressable>
      <GhostBtn label={t('saved.remove')} onPress={onRemove} />
    </Card>
  )
}
