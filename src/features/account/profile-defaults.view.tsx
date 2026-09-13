import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'
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
import { Chip, GhostBtn, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { colors } from '@/shared/ui/tokens'
import { BUDGET_TIERS } from '@/features/create-date/budget-tiers'
import { taxonomyEmoji } from '@/features/create-date/taxonomy-emoji'

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
  const { t, i18n } = useTranslation()
  const update = useUpdateProfile()
  const administrativeVersion = useAdministrativeVersion()
  const taxonomies = useTaxonomies({ kinds: INTEREST_KIND })

  const [area, setArea] = useState<AdministrativeSelection | null | undefined>(undefined)
  const [moods, setMoods] = useState<string[] | undefined>(undefined)
  const [budget, setBudget] = useState<number | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)

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
    const next = currentMoods.includes(key)
      ? currentMoods.filter(k => k !== key)
      : currentMoods.length < MAX_INTERESTS
        ? [...currentMoods, key]
        : currentMoods
    setMoods(next)
  }

  async function save() {
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
    try {
      await update.mutateAsync(patch)
      setArea(undefined)
      setMoods(undefined)
      setBudget(undefined)
      haptic('success')
      track('profile_defaults_saved', { fields: Object.keys(patch).join(',') })
      setNotice(t('account.defaultsSaved'))
    } catch {
      setNotice(t('account.defaultsFailed'))
    }
  }

  return (
    <GlassCard style={styles.card}>
      <View>
        <Text style={styles.sectionTitle}>{t('account.defaultsTitle')}</Text>
        <Text style={styles.sectionBody}>{t('account.defaultsBody')}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('account.homeArea')}</Text>
        {area === undefined && !profile.homeAdministrativeArea && profile.homeArea ? (
          <View>
            <Text style={styles.value}>{areaDisplayName(profile.homeArea)}</Text>
            <Text style={styles.hint}>{t('account.legacyArea')}</Text>
            <GhostBtn label={t('account.homeAreaClear')} onPress={() => setArea(null)} />
          </View>
        ) : null}
        <AdministrativePicker value={currentArea} onChange={setArea} />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('account.interests')}</Text>
        <Text style={styles.hint}>{t('account.interestsHint', { max: MAX_INTERESTS })}</Text>
        {taxonomies.isPending ? (
          <ActivityIndicator color={colors.brand.coral} />
        ) : taxonomies.isError ? (
          <View style={styles.valueRow}>
            <Text style={styles.problem}>{t('account.interestsFailed')}</Text>
            <GhostBtn label={t('common.retry')} onPress={() => void taxonomies.refetch()} />
          </View>
        ) : (
          <View style={styles.chips}>
            {moodOptions.map(option => (
              <Chip
                key={option.key}
                label={option.label}
                {...(option.emoji ? { icon: option.emoji } : {})}
                variant={currentMoods.includes(option.key) ? 'selected' : 'default'}
                onPress={() => toggleMood(option.key)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('account.usualBudget')}</Text>
        <View style={styles.chips}>
          <Chip
            label={t('account.usualBudgetNone')}
            variant={currentBudget === null ? 'selected' : 'default'}
            onPress={() => setBudget(null)}
          />
          {BUDGET_TIERS.map(tier => (
            <Chip
              key={tier.key}
              label={t(`createBudget.tier.${tier.key}`)}
              variant={currentBudget === tier.amount ? 'selected' : 'default'}
              onPress={() => setBudget(tier.amount)}
            />
          ))}
        </View>
      </View>

      <SecondaryBtn
        label={t('account.defaultsSave')}
        onPress={save}
        disabled={!dirty}
        loading={update.isPending}
      />
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

    </GlassCard>
  )
}
