import { BlockingLoadingOverlay, useSubmitOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { Chip } from '@/shared/ui/chip.view'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles'
import { track } from '@/shared/analytics'
import { saveAccentPreference } from '@/shared/theme/accent-preference'
import { deviceThemeName } from '@/shared/theme/use-accent-bootstrap'
import { haptic } from '@/shared/ui/feedback'
import { Icon, IconCheck } from '@/shared/ui/icons'
import { Card, PrimaryBtn } from '@/shared/ui/primitives'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { Text } from '@/shared/ui/text'
import { ACCENTS, DEFAULT_ACCENT, accentOf, themeName, themes, type Accent } from '@/shared/ui/theme'
import type { MessageKey } from '@/shared/i18n/types'
import { styles } from './theme-accent.style'

const LABEL: Record<Accent, MessageKey> = { orange: 'theme.orange', green: 'theme.green', blue: 'theme.blue', purple: 'theme.purple' }
const DESCRIPTION: Record<Accent, MessageKey> = { orange: 'g11.orange', green: 'g11.green', blue: 'g11.blue', purple: 'g11.purple' }

/** Draft colours affect only the illustrative preview. Apply commits to runtime and storage. */
export function ThemeAccentCard() {
  const { t } = useTranslation()
  const { theme, rt } = useUnistyles()
  const active = accentOf(rt.themeName) ?? DEFAULT_ACCENT
  const [chosen, setChosen] = useState<{ accent: Accent; over: Accent } | null>(null)
  const current = chosen?.over === active ? chosen.accent : active
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  const overlay = useSubmitOverlay(saving)

  async function apply() {
    if (saving) return
    setSaving(true)
    try {
      await saveAccentPreference(current)
      UnistylesRuntime.setTheme(deviceThemeName(current))
      setChosen(null)
      haptic('success')
      track('theme_accent_changed', { accent: current })
      setResult('success')
    } catch { setResult('error') }
    finally { setSaving(false) }
  }

  return <>
    <BlockingLoadingOverlay visible={saving} onClosed={overlay.onClosed} />
    <View style={styles.intro}>
      <Chip label={t('g11.themePersonalise')} />
      <Text variant="introSection" color="redesign.ink" accessibilityRole="header">{t('g11.themeHeading')}</Text>
      <Text variant="introBody" color="redesign.secondary">{t('g11.themeIntro')}</Text>
    </View>
    <View style={styles.section}>
    <View style={styles.titleRow}>
      <Text variant="introHeading" style={styles.title}>{t('g11.palette')}</Text>
      <Text variant="bodySmall" color="text.secondary">{t(current === 'orange' ? 'g11.orangeName' : LABEL[current])}</Text>
    </View>
    <Card appearance="stitch" padded={false} style={styles.card}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('account.themeTitle')} style={styles.swatches}>
        {ACCENTS.map(accent => {
          const selected = accent === current
          const { primary, onAccent, soft } = themes[themeName(accent, theme.mode)].accent
          return <Pressable key={accent} testID={`theme-swatch-${accent}`} disabled={saving}
            onPress={() => setChosen({ accent, over: active })} accessibilityRole="radio" accessibilityLabel={t(LABEL[accent])}
            accessibilityState={{ selected, checked: selected, disabled: saving }} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={[styles.ring, selected && { backgroundColor: soft }]}><View style={[styles.swatch, { backgroundColor: primary }]}>
              {selected ? <IconCheck color={onAccent} size={20} /> : null}
            </View></View>
            <Text variant="label" style={styles.optionLabel}>{t(LABEL[accent])}</Text>
            <Text variant="caption" color="text.secondary" style={styles.optionLabel}>{t(DESCRIPTION[accent])}</Text>
          </Pressable>
        })}
      </View>
    </Card>
    </View>
    <ThemeScopeProvider name={themeName(current, theme.mode)}>
      <View style={styles.section}>
        <View style={styles.titleRow}><Text variant="introHeading" style={styles.title} accessibilityRole="header">{t('g11.preview')}</Text><View style={styles.live}><View testID="theme-preview-live-dot" style={styles.liveDot} /><Text variant="introCaption" color="redesign.secondary">{t('g11.live')}</Text></View></View>
        <ThemePreview />
      </View>
    </ThemeScopeProvider>
    <PrimaryBtn variant="pill" label={t('g11.applyTheme')} leadingIcon="checkCircle" onPress={() => void apply()} loading={saving} disabled={saving} />
    <Text variant="introCaption" color="redesign.secondary" style={styles.helper}>{t('account.themeHelper')}</Text>
    <ResultSheet visible={result !== null && overlay.closed} variant={result ?? 'success'} title={t(result === 'error' ? 'g11.themeFailed' : 'g11.themeSaved')}
      body={t('account.themeHelper')} primaryAction={{ label: t('common.close'), onPress: () => setResult(null) }} onClose={() => setResult(null)} />
  </>
}

function ThemePreview() {
  const { t } = useTranslation()
  return (
    <View testID="theme-preview" style={styles.preview}>
      <Text variant="caption" color="text.secondary">{t('g11.sample')}</Text>
      <Card appearance="stitch" padded={false} style={styles.sampleCard}>
        <View style={styles.titleRow}>
          <View style={styles.sampleIcon}><Icon name="mapPin" size={28} color="accent.onSoft" /></View>
          <View style={styles.title}><Text variant="introHeading">{t('g11.sampleTitle')}</Text><Text variant="bodySmall" color="text.secondary">{t('g11.sampleBody')}</Text></View>
          <View style={styles.sampleBookmark}><Icon name="bookmark" size={20} color="accent.primary" /></View>
        </View>
        <View style={[styles.sampleButton, styles.samplePrimary]}><Text variant="introHeading" color="accent.onAccent">{t('g11.sampleAction')}</Text><Icon name="arrowRight" color="accent.onAccent" /></View>
        <View style={styles.titleRow}>
          <View style={[styles.sampleButton, styles.title, styles.sampleSecondary]}><Icon name="share" size={18} color="accent.onSoft" /><Text variant="introHeading" color="accent.onSoft">{t('g11.sampleShare')}</Text></View>
          <View style={[styles.sampleButton, styles.title, styles.sampleNeutral]}><Icon name="info" size={18} /><Text variant="introHeading">{t('g11.sampleDetail')}</Text></View>
        </View>
      </Card>
      <View><Text variant="introCaption" color="redesign.secondary">{t('g11.previewTabs')}</Text><View style={styles.sampleTabs}>{(['compass', 'calendar', 'bookmark', 'user'] as const).map((icon, index) => <View key={icon} style={styles.sampleTab}>
        <Icon name={icon} color={index === 1 ? 'accent.primary' : 'text.secondary'} />
        <Text variant="caption" color={index === 1 ? 'accent.primary' : 'text.secondary'}>{t((['tabs.home', 'tabs.plans', 'tabs.saved', 'tabs.profile'] as const)[index])}</Text>{index === 1 ? <View style={styles.activeDot} /> : null}
      </View>)}</View></View>
    </View>
  )
}
