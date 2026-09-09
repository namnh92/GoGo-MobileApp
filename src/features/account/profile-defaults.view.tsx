import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  useServiceAreas,
  useTaxonomies,
  useUpdateProfile,
  type Me,
  type OpBody,
  type ServiceArea,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { haptic } from '@/shared/ui/feedback'
import { Chip, GhostBtn, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { IconCheck } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { BUDGET_TIERS } from '@/features/create-date/budget-tiers'
import { taxonomyEmoji } from '@/features/create-date/taxonomy-emoji'

import { styles } from './profile-defaults.style'

/** The profile keeps `mood` only (ADR-0022); the room screen offers three of them. */
const INTEREST_KIND = 'mood'
export const MAX_INTERESTS = 5

/** `Quận 1, TP.HCM` — the city only when the area is not itself the city. */
export function areaDisplayName(area: { name: string; city?: string | null }): string {
  return area.city && area.city !== area.name ? `${area.name}, ${area.city}` : area.name
}

/**
 * PROF-APP-003 (#178), ADR-0022 — the defaults a new date is pre-filled from:
 * home area, interests, usual budget. Edits stay local until **Lưu mặc định**
 * sends one PATCH; `undefined` in local state means "untouched", so the patch
 * carries only what moved and `null` only where the person cleared a field.
 * Nothing here writes to a room.
 */
export function ProfileDefaultsCard({ profile }: { profile: Me }) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const update = useUpdateProfile()
  const areas = useServiceAreas()
  const taxonomies = useTaxonomies({ kinds: INTEREST_KIND })

  const [areaKey, setAreaKey] = useState<string | null | undefined>(undefined)
  const [moods, setMoods] = useState<string[] | undefined>(undefined)
  const [budget, setBudget] = useState<number | null | undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const currentAreaKey = areaKey === undefined ? (profile.homeArea?.key ?? null) : areaKey
  const currentMoods = moods ?? profile.interests?.mood ?? []
  const currentBudget = budget === undefined ? (profile.usualBudget?.perPerson ?? null) : budget
  const dirty = areaKey !== undefined || moods !== undefined || budget !== undefined

  const areaList = useMemo(() => areas.data?.areas ?? [], [areas.data])
  const byCity = useMemo(() => {
    const groups = new Map<string, ServiceArea[]>()
    for (const area of areaList) {
      const city = area.city ?? area.name
      groups.set(city, [...(groups.get(city) ?? []), area])
    }
    return [...groups.entries()]
  }, [areaList])

  const currentArea =
    areaList.find(area => area.key === currentAreaKey) ??
    (areaKey === undefined && profile.homeArea ? profile.homeArea : null)

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
    if (areaKey !== undefined) patch.homeAreaKey = areaKey
    // An empty list is a cleared field, and a cleared field is null, so the
    // server drops the row rather than keeping an empty one.
    if (moods !== undefined) patch.interests = moods.length > 0 ? { mood: moods } : null
    if (budget !== undefined) patch.usualBudget = budget === null ? null : { perPerson: budget, currency: 'VND' }
    try {
      await update.mutateAsync(patch)
      setAreaKey(undefined)
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
        <View style={styles.valueRow}>
          <Text style={currentArea ? styles.value : styles.valueMuted} numberOfLines={1}>
            {currentArea ? areaDisplayName(currentArea) : t('account.homeAreaNone')}
          </Text>
          {currentArea ? (
            <GhostBtn label={t('account.homeAreaClear')} onPress={() => setAreaKey(null)} />
          ) : null}
          <SecondaryBtn label={t('account.homeAreaPick')} onPress={() => setPickerOpen(true)} />
        </View>
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

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} accessibilityRole="button" accessibilityLabel={t('common.back')} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('account.areaPickerTitle')}</Text>
            <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing[5] }}>
              {areas.isPending ? (
                <ActivityIndicator color={colors.brand.coral} style={{ marginVertical: spacing[4] }} />
              ) : areas.isError ? (
                <View>
                  <Text style={styles.sheetState}>{t('account.areaPickerFailed')}</Text>
                  <GhostBtn label={t('common.retry')} onPress={() => void areas.refetch()} />
                </View>
              ) : byCity.length === 0 ? (
                <Text style={styles.sheetState}>{t('account.areaPickerEmpty')}</Text>
              ) : (
                byCity.map(([city, list]) => (
                  <View key={city}>
                    <Text style={styles.cityHeader}>{city}</Text>
                    {list.map(area => {
                      const active = area.key === currentAreaKey
                      return (
                        <Pressable
                          key={area.key}
                          onPress={() => {
                            setAreaKey(area.key)
                            setPickerOpen(false)
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={styles.areaRow}
                        >
                          <Text style={[styles.areaLabel, active && styles.areaLabelSelected]}>{area.name}</Text>
                          {active ? <IconCheck /> : null}
                        </Pressable>
                      )
                    })}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GlassCard>
  )
}
