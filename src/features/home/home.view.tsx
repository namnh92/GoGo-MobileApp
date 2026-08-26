import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { unsplashUrl } from '@/data/mockData'
import { useSuggestedPlans } from '@/shared/api/mock'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { useRoom, type QuickPreset } from '@/shared/store/roomStore'
import { IconClock } from '@/shared/ui/icons'
import { Atmosphere, AvatarCircle, GlassCard, RemoteImage, TagChip, useTabDockInset } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './home.style'

const { brand, neutral } = colors

const PRESET_KEYS: QuickPreset[] = ['tonight', 'weekend', 'special']

export default function HomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { uiState, setUiState, audience, participantCount, quickPreset, setQuickPreset } = useRoom()
  const plans = useSuggestedPlans()
  const dockInset = useTabDockInset()

  function startCreate() {
    track('date_create_started', { preset: quickPreset })
    router.push('/create/type')
  }

  const subtitle =
    audience === 'group-host'
      ? t('home.subtitleHostActive', { done: participantCount - 1, total: participantCount })
      : audience === 'group-guest'
        ? t('home.subtitleGuestActive', { n: 5, name: 'Max' })
        : t('home.subtitle')

  // Query loading also renders the skeleton branch — the demo selector can
  // force any state on top (state selector must actually change the render).
  const visualState = uiState === 'default' && plans.isPending ? 'loading' : uiState

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[3], paddingBottom: dockInset }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('home.greeting')}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <AvatarCircle label="M" />
        </View>

        {/* Search entry — full discovery lives at /places/search */}
        <Pressable
          onPress={() => router.push('/places/search')}
          accessibilityRole="search"
          style={styles.searchBar}
        >
          <Text style={styles.searchBarLabel}>🔍  {t('search.placeholder')}</Text>
        </Pressable>

        {/* Hero */}
        <View style={styles.hero}>
          <RemoteImage uri={unsplashUrl('photo-1748591633516-94b4b80cdc6a', 800, 500)} style={StyleSheet.absoluteFill} />
          <View style={styles.heroScrim} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>🌙 {t('home.heroBadge')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
            <Text style={styles.heroBody}>{t('home.heroBody')}</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={startCreate} style={({ pressed }) => [styles.heroBtn, { backgroundColor: brand.coral }, pressed && { transform: [{ scale: 0.98 }] }]}>
                <Text style={styles.heroBtnLabel}>{t('home.createDate')}</Text>
              </Pressable>
              <Pressable onPress={startCreate} style={({ pressed }) => [styles.heroBtn, { backgroundColor: brand.lavenderGlass }, pressed && { opacity: 0.9 }]}>
                <Text style={styles.heroBtnLabel}>{t('home.quickPick')}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Quick presets — context filter for the next room, not a create action */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing[5] }} contentContainerStyle={{ paddingHorizontal: spacing[5], gap: spacing[3] }}>
          {content.quickPresets.map((preset, i) => {
            const key = PRESET_KEYS[i]
            const active = quickPreset === key
            return (
              <Pressable
                key={preset.label}
                onPress={() => setQuickPreset(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.preset, active ? { backgroundColor: brand.coral } : styles.presetGlass]}
              >
                <Text style={[styles.presetLabel, { color: active ? neutral[0] : neutral[500] }]}>
                  {preset.emoji} {preset.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Suggested plans */}
        <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[6] }}>
          <Text style={styles.sectionTitle}>{t('home.suggested')}</Text>

          {visualState === 'loading' && (
            <View style={{ gap: spacing[3] }}>
              {[0, 1, 2].map(i => (
                <GlassCard key={i} style={styles.skeletonCard}>
                  <View style={styles.skeletonThumb} />
                  <View style={{ flex: 1, padding: spacing[3], gap: spacing[2] }}>
                    <View style={[styles.skeletonLine, { width: '66%' }]} />
                    <View style={[styles.skeletonLine, { width: '50%' }]} />
                    <View style={[styles.skeletonLine, { width: '33%' }]} />
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {visualState === 'empty' && (
            <GlassCard style={styles.stateCard}>
              <Text style={styles.stateEmoji}>🗺️</Text>
              <Text style={styles.stateTitle}>{t('home.emptyTitle')}</Text>
              <Text style={styles.stateBody}>{t('home.emptyBody')}</Text>
              <View style={{ gap: spacing[2], alignSelf: 'stretch', marginTop: spacing[4] }}>
                {(['home.recoverRadius', 'home.recoverTime', 'home.recoverBudget', 'home.recoverNearest'] as const).map(key => (
                  <Pressable key={key} onPress={() => setUiState('default')} style={styles.recoverBtn}>
                    <Text style={styles.recoverLabel}>{t(key)}</Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          )}

          {visualState === 'error' && (
            <GlassCard style={styles.stateCard}>
              <Text style={styles.stateEmoji}>📡</Text>
              <Text style={styles.stateTitle}>{t('home.error')}</Text>
              <Text style={styles.stateBody}>{t('home.errorBody')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
                <Pressable onPress={() => setUiState('default')} style={[styles.recoverBtn, { backgroundColor: brand.coral, paddingHorizontal: spacing[5] }]}>
                  <Text style={[styles.recoverLabel, { color: neutral[0] }]}>{t('home.retry')}</Text>
                </Pressable>
                <Pressable onPress={startCreate} style={[styles.recoverBtn, styles.recoverOutline]}>
                  <Text style={styles.recoverLabel}>{t('home.createManual')}</Text>
                </Pressable>
              </View>
            </GlassCard>
          )}

          {visualState === 'default' && (
            <View style={{ gap: spacing[3] }}>
              {(plans.data ?? []).map(plan => (
                <Pressable key={plan.title} onPress={() => router.push('/plans/tonight')}>
                  <GlassCard style={styles.planCard}>
                    <RemoteImage uri={unsplashUrl(plan.img, 200, 160)} style={styles.planThumb} />
                    <View style={{ flex: 1, padding: spacing[3] }}>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      <View style={styles.planMeta}>
                        <IconClock />
                        <Text style={styles.planMetaLabel}>{plan.duration} · {plan.area}</Text>
                      </View>
                      <View style={styles.planTags}>
                        {plan.tags.map(tag => (
                          <TagChip key={tag} label={tag} />
                        ))}
                        <Text style={styles.planBudget}>~{plan.budget}</Text>
                      </View>
                    </View>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
