import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEMO_PLAN_ID, unsplashUrl } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { usePriceFormatter } from '@/shared/pricing'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, GhostBtn, GlassCard, PrimaryBtn, RemoteImage, Toast } from '@/shared/ui/primitives'
import { IconCheck, IconZap } from '@/shared/ui/icons'
import { colors, spacing, onDark } from '@/shared/ui/tokens'
import { styles } from './match-result.style'

const { brand, neutral } = colors

export default function MatchResultScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { roomType, participantCount, canRegenerate, lockedStops } = useRoom()
  const { planTotal } = usePriceFormatter()
  const [refineOpen, setRefineOpen] = useState(false)
  const [reasons, setReasons] = useState<string[]>([])
  const [customRequest, setCustomRequest] = useState('')
  const [lockChoice, setLockChoice] = useState<'keep' | 'drop'>('keep')
  const [submitting, setSubmitting] = useState(false)
  const [diff, setDiff] = useState(false)
  const [sent, setSent] = useState(false)
  const exclusiveLabel = content.refinementOptions[content.refinementOptions.length - 1].label
  const lockConflict = reasons.includes(exclusiveLabel) && lockedStops.length > 0
  const formEmpty = reasons.length === 0 && customRequest.trim() === ''

  function viewPlan() {
    track('date_plan_viewed')
    router.push(`/plans/${DEMO_PLAN_ID}`)
  }

  function toggleReason(label: string) {
    setReasons(prev => {
      if (prev.includes(label)) return prev.filter(x => x !== label)
      if (label === exclusiveLabel) return [label]
      return [...prev.filter(x => x !== exclusiveLabel), label]
    })
  }

  function regenerate() {
    if (submitting || formEmpty) return
    setSubmitting(true)
    // Guests send a proposal to the host; hosts regenerate directly (spec v4 §35)
    track('recommendation_refinement_selected', {
      reasons: reasons.join(','),
      custom: customRequest.trim().length > 0,
      role: canRegenerate ? 'host' : 'guest',
      lockChoice: lockConflict ? lockChoice : 'n/a',
    })
    setTimeout(() => {
      setSubmitting(false)
      setRefineOpen(false)
      setReasons([])
      setCustomRequest('')
      if (canRegenerate) {
        setDiff(true)
        setTimeout(() => setDiff(false), 3500)
      } else {
        setSent(true)
        setTimeout(() => setSent(false), 2500)
      }
    }, 600)
  }

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[3], paddingBottom: spacing[8] }}>
        {/* Hero */}
        <View style={styles.hero}>
          <RemoteImage uri={unsplashUrl('photo-1562436260-126d541901e0', 700, 500)} style={StyleSheet.absoluteFill} />
          <View style={styles.heroScrim} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>⚡ {roomType === 'group' ? t('matchResult.groupTitle') : t('matchResult.matchBadge')}</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle}>Japanese + Pottery</Text>
            {roomType === 'group' && (
              <Text style={styles.heroVotes}>
                {t('matchResult.groupVotes', { likes: participantCount - 1, total: participantCount, vetoes: 0 })}
              </Text>
            )}
            <Text style={styles.heroMeta}>⏱ 3h 30m · 💰 {planTotal(750)} · 📍 4.2 km</Text>
          </View>
        </View>

        {/* Stop categories */}
        <View style={styles.stopsRow}>
          {content.stopCategories.map(c => (
            <GlassCard key={c.label} style={styles.stopChip}>
              <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
              <Text style={styles.stopChipLabel}>{c.label}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Reasons */}
        <GlassCard style={styles.reasonCard}>
          <View style={styles.reasonTitleRow}>
            <IconZap />
            <Text style={styles.reasonTitle}>{t('matchResult.whyTitle')}</Text>
          </View>
          {(roomType === 'group' ? content.groupMatchReasons : content.matchReasons).map(r => (
            <View key={r} style={styles.reasonRow}>
              <IconCheck />
              <Text style={styles.reasonLabel}>{r}</Text>
            </View>
          ))}
        </GlassCard>

        <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[5], gap: spacing[2] }}>
          <PrimaryBtn label={t('matchResult.viewPlan')} onPress={viewPlan} />
          <GhostBtn
            label={canRegenerate ? t('matchResult.another') : t('matchResult.suggestToHost')}
            onPress={() => setRefineOpen(true)}
          />
        </View>
      </ScrollView>

      {sent && <Toast message={t('matchResult.suggestionSent')} />}
      {diff && (
        <View style={[styles.diffCard, { top: insets.top + spacing[6] }]} accessibilityLiveRegion="polite">
          <Text style={styles.diffLine}>✓ {t('matchResult.diffKept', { name: 'Sakura Omakase' })}</Text>
          <Text style={[styles.diffLine, { color: onDark.medium }]}>
            {t('matchResult.diffChanged', { from: 'Clay & Co.', to: 'Paint & Sip' })}
          </Text>
          <Text style={[styles.diffLine, { color: brand.mint }]}>{t('matchResult.diffSaved', { amount: '120k' })}</Text>
        </View>
      )}

      {/* Refinement bottom sheet — never regenerate blindly */}
      <Modal visible={refineOpen} transparent animationType="slide" onRequestClose={() => setRefineOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRefineOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[6] }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{canRegenerate ? t('matchResult.refineTitle') : t('matchResult.suggestTitle')}</Text>
          <View style={styles.reasonGrid}>
            {content.refinementOptions.map(r => {
              const active = reasons.includes(r.label)
              return (
                <Pressable
                  key={r.label}
                  onPress={() => toggleReason(r.label)}
                  accessibilityState={{ selected: active }}
                  style={[styles.reasonBtn, active ? { backgroundColor: brand.coral } : { backgroundColor: neutral[50] }]}
                >
                  <Text style={[styles.reasonBtnLabel, { color: active ? neutral[0] : neutral[900] }]}>
                    {active ? '✓' : r.emoji} {r.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <View>
            <TextInput
              value={customRequest}
              onChangeText={text => setCustomRequest(text.slice(0, 150))}
              maxLength={150}
              placeholder={t('matchResult.customRequest')}
              placeholderTextColor={neutral[300]}
              style={styles.input}
            />
            {customRequest.length >= 120 && (
              <Text style={styles.charCount}>{t('matchResult.charCount', { n: customRequest.length })}</Text>
            )}
          </View>

          {/* Lock conflict — resolved BEFORE submit (spec v4 §38.3) */}
          {lockConflict && (
            <View style={styles.lockCard}>
              <Text style={styles.lockTitle}>🔒 {t('matchResult.lockConflict', { n: lockedStops.length })}</Text>
              {(['keep', 'drop'] as const).map(choice => (
                <Pressable key={choice} onPress={() => setLockChoice(choice)} style={styles.lockRow}>
                  <View style={[styles.radio, { borderColor: lockChoice === choice ? brand.coral : neutral[300] }]}>
                    {lockChoice === choice && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.lockLabel}>{t(choice === 'keep' ? 'matchResult.keepLocked' : 'matchResult.dropLocked')}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            onPress={regenerate}
            disabled={formEmpty || submitting}
            style={[styles.submitBtn, (formEmpty || submitting) && { opacity: 0.4 }]}
          >
            <Text style={styles.submitLabel}>
              {submitting ? '…' : canRegenerate ? t('matchResult.regenerate') : t('matchResult.sendSuggestion')}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </Atmosphere>
  )
}
