import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { OfflineState } from '@/shared/ui/async-state.view'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { AdministrativePicker } from '@/shared/administrative/administrative-picker.view'
import { useAdministrativeVersion } from '@/shared/administrative/queries'
import type { AdministrativeSelection } from '@/shared/administrative/snapshot'

import {
  useTaxonomies,
  useUpdateProfile,
  type Me,
  type OpBody,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { serviceAreaLabel } from '@/shared/location/area-label'
import { haptic } from '@/shared/ui/feedback'
import { Icon } from '@/shared/ui/icons'
import { Card, Chip, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { BUDGET_TIERS } from '@/features/create-date/budget-tiers'
import { taxonomyEmoji } from '@/features/create-date/taxonomy-emoji'
import { Text } from '@/shared/ui/text'

import { ResultSheet } from '@/shared/ui/result-sheet.view'

import { styles } from './profile-defaults.style'

/** The profile keeps `mood` only (ADR-0022); the room screen offers three of them. */
const INTEREST_KIND = 'mood'
export const MAX_INTERESTS = 5

/** `Quận 1, TP.HCM` — the city only when the area is not itself the city. */
export const areaDisplayName = serviceAreaLabel

/**
 * PROF-APP-003 (#178), ADR-0022 — the defaults a new date is pre-filled from:
 * home area, interests, usual budget. Edits stay local until **Lưu mặc định**
 * sends one PATCH; `undefined` in local state means "untouched", so the patch
 * carries only what moved and `null` only where the person cleared a field.
 * Nothing here writes to a room.
 */
export function ProfileDefaultsCard({ profile }: { profile: Me }) {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const update = useUpdateProfile()
  const saving = useRef(false)
  const administrativeVersion = useAdministrativeVersion()
  const taxonomies = useTaxonomies({ kinds: INTEREST_KIND })
  const waiting = useWaitingForNetwork(taxonomies)

  const [area, setArea] = useState<AdministrativeSelection | null | undefined>(undefined)
  const [moods, setMoods] = useState<string[] | undefined>(undefined)
  const [budget, setBudget] = useState<number | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  const currentArea = area === undefined ? (profile.homeAdministrativeArea ?? null) : area
  const currentMoods = moods ?? profile.interests?.mood ?? []
  const currentBudget = budget === undefined ? (profile.usualBudget?.perPerson ?? null) : budget
  const dirty = area !== undefined || moods !== undefined || budget !== undefined

  const moodOptions = useMemo(() => {
    const entries = taxonomies.data?.kinds?.[INTEREST_KIND] ?? []
    return entries.map(entry => ({
      key: entry.key ?? '',
      label: entry.labels?.[i18n.language] ?? entry.labels?.vi ?? entry.key ?? '',
      emoji: taxonomyEmoji(entry.key ?? ''),
    }))
  }, [taxonomies.data, i18n.language])

  function toggleMood(key: string) {
    if (saving.current) return
    const next = currentMoods.includes(key)
      ? currentMoods.filter(k => k !== key)
      : currentMoods.length < MAX_INTERESTS
        ? [...currentMoods, key]
        : currentMoods
    setMoods(next)
  }

  async function save() {
    if (saving.current) return
    setNotice(null)
    const patch: OpBody<'updateProfile'> = {}
    if (area !== undefined) {
      if (area && area.datasetVersion !== administrativeVersion.data?.datasetVersion) {
        setNotice(t('administrative.changed'))
        return
      }
      patch.homeAdministrativeArea = area === null ? null : {
        datasetVersion: area.datasetVersion, provinceCode: area.provinceCode, communeCode: area.communeCode,
      }
    }
    // An empty list is a cleared field, and a cleared field is null, so the
    // server drops the row rather than keeping an empty one.
    if (moods !== undefined) patch.interests = moods.length > 0 ? { mood: moods } : null
    if (budget !== undefined) patch.usualBudget = budget === null ? null : { perPerson: budget, currency: 'VND' }
    saving.current = true
    try {
      await update.mutateAsync(patch)
      setArea(undefined)
      setMoods(undefined)
      setBudget(undefined)
      haptic('success')
      track('profile_defaults_saved', { fields: Object.keys(patch).join(',') })
      setResult('success')
    } catch {
      setResult('error')
    } finally { saving.current = false }
  }

  return (
    <>
    <Card appearance="stitch" padded={false} style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.icon}>
          <Icon name="sliders" size={20} color="accent.onSoft" />
        </View>
        <View style={styles.titleText}>
          <Text variant="title2">{t('account.defaultsTitle')}</Text>
          <Text variant="bodySmall" color="text.secondary">{t('account.defaultsBody')}</Text>
        </View>
      </View>
    </Card>

    <Card appearance="stitch" padded={false} style={styles.field}>
        <Text variant="label">{t('account.homeArea')}</Text>
        {area === undefined && !profile.homeAdministrativeArea && profile.homeArea ? (
          <View>
            <Text style={styles.value}>{areaDisplayName(profile.homeArea)}</Text>
            <Text variant="caption" color="text.secondary">{t('account.legacyArea')}</Text>
            <GhostBtn label={t('account.homeAreaClear')} onPress={() => { if (!saving.current) setArea(null) }} />
          </View>
        ) : null}
        <AdministrativePicker value={currentArea} onChange={value => { if (!saving.current) setArea(value) }} />
    </Card>

    <Card appearance="stitch" padded={false} style={styles.field}><View style={styles.budgetGroup} accessibilityRole="radiogroup" accessibilityLabel={t('account.usualBudget')}>
        <Text variant="title2">{t('account.usualBudget')}</Text>
        <Text variant="caption" color="text.secondary">{t('g11.perPerson')}</Text>
        {[{ key: 'none', amount: null }, ...BUDGET_TIERS].map(tier => (
          <Pressable key={tier.key} accessibilityRole="radio" accessibilityState={{ checked: currentBudget === tier.amount }}
            onPress={() => { if (!saving.current) setBudget(tier.amount) }} style={({ pressed }) => [styles.budgetRow, currentBudget === tier.amount && styles.budgetSelected, pressed && styles.pressed]}>
            <Text style={styles.titleText}>{tier.key === 'none' ? t('account.usualBudgetNone') : t(`createBudget.tier.${tier.key}`)}</Text>
            <View style={[styles.radio, currentBudget === tier.amount && styles.radioSelected]}>{currentBudget === tier.amount ? <Icon name="check" size={16} color="accent.onSoft" /> : null}</View>
          </Pressable>
        ))}
        {currentBudget !== null && !BUDGET_TIERS.some(tier => tier.amount === currentBudget) ? <Text variant="bodySmall">{t('g11.currentBudget', { amount: new Intl.NumberFormat(i18n.language).format(currentBudget) })}</Text> : null}
      </View></Card>

    <Card appearance="stitch" padded={false} style={styles.field}>
        <Text variant="title2">{t('account.interests')}</Text>
        <Text variant="caption" color="accent.onSoft">{t('g11.selected', { count: currentMoods.length })}</Text>
        <Text variant="caption" color="text.secondary">{t('account.interestsHint', { max: MAX_INTERESTS })}</Text>
        {taxonomies.isPending ? (
          waiting ? <OfflineState /> : <ActivityIndicator color={theme.accent.primary} />
        ) : taxonomies.isError ? (
          <View style={styles.valueRow}>
            <Text variant="bodySmall" color="status.warningText">{t('account.interestsFailed')}</Text>
            <GhostBtn label={t('common.retry')} onPress={() => void taxonomies.refetch()} />
          </View>
        ) : moodOptions.length === 0 ? <Text variant="bodySmall" color="text.secondary">{t('g11.noInterests')}</Text> : (
          <View style={styles.chips}>
            {moodOptions.map(option => (
              <Chip
                key={option.key}
                label={option.label}
                {...(option.emoji ? { emoji: option.emoji } : {})}
                variant={currentMoods.includes(option.key) ? 'selected' : 'default'}
                onPress={() => toggleMood(option.key)}
              />
            ))}
          </View>
        )}
    </Card>

      <Text variant="bodySmall" color="text.secondary">{t('g11.defaultsNote')}</Text>
      <PrimaryBtn
        label={t('account.defaultsSave')}
        onPress={save}
        icon="check"
        disabled={!dirty}
        loading={update.isPending}
      />
      {notice ? (
        <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

    <ResultSheet visible={result !== null} variant={result ?? 'success'} title={t(result === 'error' ? 'account.defaultsFailed' : 'account.defaultsSaved')}
      body={t('account.defaultsBody')} primaryAction={{ label: t('common.close'), onPress: () => setResult(null) }} onClose={() => setResult(null)} />
    </>
  )
}
