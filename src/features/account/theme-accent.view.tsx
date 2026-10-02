import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'

import { track } from '@/shared/analytics'
import { accentSchema, saveAccentPreference } from '@/shared/theme/accent-preference'
import { haptic } from '@/shared/ui/feedback'
import { IconCheck } from '@/shared/ui/icons'
import { GlassCard } from '@/shared/ui/primitives'
import { ACCENTS, DEFAULT_ACCENT, themes, type Accent } from '@/shared/ui/theme'
import type { MessageKey } from '@/shared/i18n/types'

import { styles } from './theme-accent.style'

/** Theme keys are taxonomy keys; the label is i18n (`theme.orange` = "Cam"). */
const LABEL: Record<Accent, MessageKey> = {
  orange: 'theme.orange',
  green: 'theme.green',
  blue: 'theme.blue',
  purple: 'theme.purple',
}

/** What is on screen now. `AppProviders` applied the saved choice before the splash came down. */
function activeAccent(): Accent {
  const parsed = accentSchema.safeParse(UnistylesRuntime.themeName)
  return parsed.success ? parsed.data : DEFAULT_ACCENT
}

/**
 * "Màu chủ đề" (#293 §6, #297). One tap swaps the Unistyles theme — every
 * `StyleSheet.create(theme => …)` and `useUnistyles()` reader repaints without
 * a restart — and stores the key on the device so the next launch starts in it.
 * Nothing goes to the server.
 */
export function ThemeAccentCard() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState<Accent>(activeAccent)

  function choose(accent: Accent) {
    if (accent === current) return
    UnistylesRuntime.setTheme(accent)
    setCurrent(accent)
    // Storage failure must not undo what the user just saw change: the choice
    // holds for this session and the next launch falls back to orange.
    void saveAccentPreference(accent)
    haptic('select')
    track('theme_accent_changed', { accent })
  }

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.title}>{t('account.themeTitle')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('account.themeTitle')} style={styles.swatches}>
        {ACCENTS.map(accent => {
          const selected = accent === current
          const { primary, onAccent } = themes[accent].accent
          return (
            <Pressable
              key={accent}
              testID={`theme-swatch-${accent}`}
              onPress={() => choose(accent)}
              accessibilityRole="radio"
              accessibilityLabel={t(LABEL[accent])}
              accessibilityState={{ selected, checked: selected }}
              style={[styles.ring, selected && { borderColor: primary }]}
            >
              {/* The swatch shows a theme other than the active one, so its fill is that theme's value. */}
              <View style={[styles.swatch, { backgroundColor: primary }]}>
                {selected ? <IconCheck color={onAccent} size={20} /> : null}
              </View>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.helper}>{t('account.themeHelper')}</Text>
    </GlassCard>
  )
}
