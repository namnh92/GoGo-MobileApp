import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { env } from '@/shared/config/env'
import { locales, useLocaleContent } from '@/shared/i18n'
import { useRoom, type DemoAudience, type DemoUIState } from '@/shared/store/roomStore'
import { Atmosphere, AvatarCircle, GlassCard, TagChip, useTabDockInset } from '@/shared/ui/primitives'
import { IconChevronRight } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './profile.style'

const audiences: DemoAudience[] = ['couple', 'group-host', 'group-guest']
const uiStates: DemoUIState[] = ['default', 'loading', 'empty', 'error']

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const room = useRoom()
  const dockInset = useTabDockInset()

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[2], paddingBottom: dockInset }}>
        <View style={styles.headerRow}>
          <AvatarCircle label="M" size={64} />
          <View>
            <Text style={styles.name}>Max</Text>
            <Text style={styles.email}>max@gogo.vn</Text>
          </View>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.caption}>{t('profile.couple')}</Text>
          <View style={styles.coupleRow}>
            <AvatarCircle label="M" size={40} />
            <Text style={{ color: colors.neutral[300], fontSize: 20 }}>+</Text>
            <AvatarCircle emoji="😊" size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.coupleTagline}>{t('profile.coupleTagline')}</Text>
              <Text style={styles.coupleSince}>{t('profile.coupleSince')}</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.caption}>{t('profile.prefsTitle')}</Text>
          <Text style={styles.prefLabel}>{t('profile.likes')}</Text>
          <View style={styles.prefRow}>
            {['🍣 Japanese', '🎨 Creative', '😌 Quiet', '🌃 Night vibe'].map(x => (
              <TagChip key={x} label={x} color="coral" />
            ))}
          </View>
          <Text style={styles.prefLabel}>{t('profile.dislikes')}</Text>
          <View style={[styles.prefRow, { marginBottom: 0 }]}>
            {['🔊 Loud', '👥 Crowded'].map(x => (
              <TagChip key={x} label={x} />
            ))}
          </View>
        </GlassCard>

        <GlassCard style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          {content.settingsItems.map((item, i) => (
            <Pressable key={item} style={[styles.settingRow, i === content.settingsItems.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.settingLabel}>{item}</Text>
              <IconChevronRight />
            </Pressable>
          ))}
        </GlassCard>

        {/* Demo controls (dev only): audience × UI state are independent
            dimensions (spec v3 §22); stripped from production builds. */}
        {__DEV__ && (
          <GlassCard style={styles.card}>
            <Text style={styles.caption}>Demo · {env.name}</Text>
            <View style={styles.segmentRow}>
              {audiences.map(a => (
                <Pressable key={a} onPress={() => room.setAudience(a)} style={[styles.segmentBtn, room.audience === a && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentLabel, room.audience === a && styles.segmentLabelActive]}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segmentRow, { marginTop: spacing[2] }]}>
              {uiStates.map(s => (
                <Pressable key={s} onPress={() => room.setUiState(s)} style={[styles.segmentBtn, room.uiState === s && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentLabel, room.uiState === s && styles.segmentLabelActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segmentRow, { marginTop: spacing[2] }]}>
              {locales.map(l => (
                <Pressable key={l} onPress={() => void i18n.changeLanguage(l)} style={[styles.segmentBtn, i18n.resolvedLanguage === l && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentLabel, i18n.resolvedLanguage === l && styles.segmentLabelActive]}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        )}

        <Pressable style={styles.logout}>
          <Text style={styles.logoutLabel}>{t('profile.logout')}</Text>
        </Pressable>
      </ScrollView>
    </Atmosphere>
  )
}
