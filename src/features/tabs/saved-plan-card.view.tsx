import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import type { Plan } from '@/shared/api'
import { GhostBtn, GlassCard } from '@/shared/ui/primitives'

import { styles } from './saved-plan-card.style'

/**
 * A saved plan in the Saved list. Its warnings say what is wrong in words, not
 * by colour alone; a plan that can no longer be read stays removable.
 */
export function SavedPlanCard({ plan, onOpen, onRemove }: { plan?: Plan; onOpen: () => void; onRemove: () => void }) {
  const { t } = useTranslation()
  return (
    <GlassCard style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !plan }}
        disabled={!plan}
        onPress={onOpen}
        style={styles.body}
      >
        <Text style={styles.glyph}>🗓️</Text>
        <View style={styles.text}>
          <Text style={styles.title}>{t('saved.plan.title')}</Text>
          <Text style={styles.meta}>
            {plan ? t('saved.plan.stops', { n: plan.stops?.length ?? 0 }) : t('saved.plan.missing')}
          </Text>
          {plan?.isStale ? <Text style={styles.warning}>⚠️ {t('saved.plan.stale')}</Text> : null}
          {plan?.hasUnavailableStops ? <Text style={styles.warning}>⚠️ {t('saved.plan.unavailable')}</Text> : null}
        </View>
      </Pressable>
      <GhostBtn label={t('saved.remove')} onPress={onRemove} />
    </GlassCard>
  )
}
