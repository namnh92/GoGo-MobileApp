import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import {
  discoveryLabels,
  isApiError,
  newIdempotencyKey,
  useContributionDrafts,
  useDeleteContributionDraft,
  useReadContributionDraft,
  useSaveContributionDraft,
  useTaxonomies,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { Chip, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { FieldFocusGroup } from '@/shared/ui/field-focus-group'
import {
  amenityFields,
  draftEnrichment,
  emptyContribution,
  priceValid,
  resumeContribution,
  stepValid,
  submissionEnrichment,
  type ContributionDraft,
  type ContributionForm,
  type Enrichment,
} from './contribution-form'
import { purposeOptions, vibeOptions, ratingOptions } from './contribution-options'
import { styles } from './contribution-wizard.style'
const amenityIcons = {
  car_parking: 'parking',
  power_at_each_table: 'power',
  pets_allowed: 'pets',
  separate_smoking_area: 'smoking',
  open_after_23: 'night',
  tables_over_six: 'groups',
} as const

export function ContributionWizard({
  googlePlaceId,
  registered,
  online,
  submitting,
  blocked,
  onSubmit,
  onBack,
  onFocus,
}: {
  googlePlaceId: string
  registered: boolean
  online: boolean
  submitting: boolean
  blocked: boolean
  onSubmit: (enrichment: Enrichment) => void
  onBack: () => void
  onFocus: () => void
}) {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const { control, setValue, reset } = useForm<ContributionForm>({
    defaultValues: emptyContribution(),
  })
  const form = useWatch({ control }) as ContributionForm
  const [step, setStep] = useState(1)
  const [saved, setSaved] = useState<ContributionDraft | null>(null)
  const [message, setMessage] = useState<'saved' | 'failed' | 'conflict' | 'limit' | 'deleted' | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const taxonomies = useTaxonomies({
    kinds: 'suitability,mood,amenity,checkin_tag',
  })
  const labels = discoveryLabels(taxonomies.data, i18n.language)
  const drafts = useContributionDrafts(registered)
  const save = useSaveContributionDraft()
  const read = useReadContributionDraft()
  const remove = useDeleteContributionDraft()
  const busy = submitting || save.isPending || read.isPending || remove.isPending
  const disabled = busy || !online
  const existing = drafts.data?.items.filter((d) => d.googlePlaceId === googlePlaceId) ?? []
  const supported = (kind: string, keys: readonly string[]) => keys.filter((key) => !!labels[kind]?.[key])
  const purposes = supported('suitability', purposeOptions)
  const vibes = supported('mood', vibeOptions)
  const amenities = supported('amenity', amenityFields)
  const taxonomyReady =
    !taxonomies.isPending && !taxonomies.isError && purposes.length > 0 && vibes.length > 0
  const validKeys =
    form.purposeKeys.every((k) => purposes.includes(k)) &&
    form.vibeKeys.every((k) => vibes.includes(k)) &&
    Object.keys(form.amenities).every((k) => amenities.includes(k))

  const serializableForm = {
    ...form,
    serviceChips: form.serviceChips.filter((k) => ratingOptions.includes(k) && !!labels.checkin_tag?.[k]),
    spaceChips: form.spaceChips.filter((k) => ratingOptions.includes(k) && !!labels.checkin_tag?.[k]),
  }

  function choices(field: 'purposeKeys' | 'vibeKeys', keys: string[], max: number) {
    return (
      <View style={styles.row}>
        {keys.map((key) => {
          const selected = form[field].includes(key)
          return (
            <Chip
              key={key}
              label={t(`placeWizard.option.${key}`)}
              appearance="mood"
              style={[styles.option, selected && styles.selectedOption]}
              variant={
                disabled || (!selected && form[field].length >= max)
                  ? 'disabled'
                  : selected
                    ? 'selected'
                    : 'default'
              }
              onPress={() =>
                setValue(field, selected ? form[field].filter((k) => k !== key) : [...form[field], key])
              }
            />
          )
        })}
      </View>
    )
  }
  function sectionTitle(title: string, icon: Parameters<typeof MaterialIcon>[0]['name'], tag?: string) {
    return (
      <View style={styles.heading}>
        <MaterialIcon name={icon} size={18} color="redesign.primaryText" />
        <Text variant="introHeading" style={styles.headingText}>
          {title}
        </Text>
        {tag ? (
          <Text variant="introCaption" color="redesign.secondary" style={styles.sectionTag}>
            {tag}
          </Text>
        ) : null}
      </View>
    )
  }
  function reward(amount: number, bonus = false) {
    return (
      <View style={[styles.reward, bonus && styles.bonus]}>
        <Text variant="introCaption" color={bonus ? 'redesign.greenText' : 'redesign.white'}>
          {t('placeWizard.reward', { amount })}
        </Text>
        <Text variant="introCaption" color={bonus ? 'redesign.greenText' : 'redesign.white'}>
          {t('placeWizard.onApproval')}
        </Text>
      </View>
    )
  }

  function textField(
    field: 'min' | 'max' | 'recommendedDishes' | 'visitTips',
    label: string,
    maxLength: number,
    numeric = false,
    placeholder?: string,
  ) {
    return (
      <FieldFocusGroup style={styles.field}>
        {field !== 'visitTips' ? (
          <Text variant="introSmall" color="redesign.secondary">
            {label}
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          value={
            field === 'visitTips'
              ? [form.recommendedDishes, form.visitTips].filter(Boolean).join(' — ')
              : form[field]
          }
          editable={!disabled}
          onChangeText={(value) => {
            if (field === 'visitTips') setValue('recommendedDishes', '')
            setValue(field, value)
          }}
          onFocus={onFocus}
          keyboardType={numeric ? 'number-pad' : 'default'}
          placeholder={placeholder}
          multiline={false}
          maxLength={maxLength}
          placeholderTextColor={theme.redesign.secondary}
          style={styles.input}
        />
      </FieldFocusGroup>
    )
  }

  function rating() {
    const value = form.serviceRating === form.spaceRating ? form.serviceRating : 0
    return (
      <View style={styles.ratingRow}>
        <View style={styles.stars} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityLabel={t('placeWizard.stars', {
                category: t('placeWizard.ratings'),
                count: n,
              })}
              accessibilityState={{ checked: value === n, disabled }}
              disabled={disabled}
              style={styles.star}
              onPress={() => {
                const next = value === n ? 0 : n
                setValue('serviceRating', next)
                setValue('spaceRating', next)
              }}
            >
              <MaterialIcon
                name={value >= n ? 'star' : 'starOutline'}
                size={26}
                color={value >= n ? 'status.warningText' : 'redesign.outline'}
              />
            </Pressable>
          ))}
        </View>
        <Text variant="introSmall">
          {value ? t(`placeWizard.score${value}`, { score: value.toFixed(1) }) : t('placeWizard.unrated')}
        </Text>
      </View>
    )
  }

  function fail(error: unknown) {
    const conflict = isApiError(error) && error.code === 'DRAFT_MODIFIED'
    setNeedsReload(conflict)
    setMessage(
      conflict ? 'conflict' : isApiError(error) && error.code === 'DRAFT_LIMIT_REACHED' ? 'limit' : 'failed',
    )
  }
  async function load(draft: Pick<ContributionDraft, 'id'>) {
    if (lock.current || disabled) return
    lock.current = true
    try {
      const fresh = await read.mutateAsync(draft.id)
      if (!mounted.current) return
      reset(resumeContribution(fresh.enrichment))
      setSaved(fresh)
      setDraftId(fresh.id)
      setStep(1)
      setMessage(null)
      setNeedsReload(false)
      track('place_contribution_draft_resumed')
    } catch (error) {
      if (mounted.current) fail(error)
    } finally {
      lock.current = false
    }
  }
  async function saveDraft() {
    if (lock.current || disabled || !registered || needsReload || !priceValid(form) || !validKeys) return
    lock.current = true
    const idToSave = draftId ?? newIdempotencyKey()
    setDraftId(idToSave)
    setMessage(null)
    try {
      const result = await save.mutateAsync({
        id: idToSave,
        body: {
          googlePlaceId,
          expectedVersion: saved?.version ?? 0,
          enrichment: draftEnrichment(serializableForm),
        },
      })
      if (!mounted.current) return
      setSaved(result)
      setDraftId(result.id)
      setMessage('saved')
      track('place_contribution_draft_saved')
    } catch (error) {
      if (mounted.current) fail(error)
    } finally {
      lock.current = false
    }
  }
  async function deleteDraft(draft: ContributionDraft) {
    if (lock.current || disabled) return
    lock.current = true
    try {
      await remove.mutateAsync({ id: draft.id, version: draft.version })
      if (!mounted.current) return
      if (saved?.id === draft.id) {
        setSaved(null)
        setDraftId(null)
        setNeedsReload(false)
      }
      setMessage('deleted')
      track('place_contribution_draft_deleted')
    } catch (error) {
      if (mounted.current) fail(error)
    } finally {
      lock.current = false
    }
  }
  function move(next: number) {
    setStep(next)
    track('place_contribution_step_viewed', { step: next })
  }
  const complete = submissionEnrichment(serializableForm)
  const submitDisabled = disabled || blocked || !complete || !taxonomyReady || !validKeys
  return (
    <View testID="contribution-wizard" style={styles.root}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <View style={styles.headerIcon}>
              <MaterialIcon name="editNote" size={18} color="redesign.primaryText" />
            </View>
            <Text variant="introHeading" style={styles.headingText}>
              {t('placeWizard.title')}
            </Text>
            {reward(50)}
          </View>
          <View style={styles.progress}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={styles.progressItem}
                accessibilityLabel={t('placeWizard.progress', {
                  step: n,
                  status: t(
                    n < step && stepValid(form, n)
                      ? 'placeWizard.complete'
                      : n === step
                        ? 'placeWizard.current'
                        : n === 3
                          ? 'placeWizard.photoBonus'
                          : n === 2
                            ? 'placeWizard.experience'
                            : 'placeWizard.mandatory',
                  ),
                })}
              >
                <View
                  style={[
                    styles.progressLine,
                    n < step ? styles.completeLine : n === step && styles.currentLine,
                  ]}
                />
                <Text
                  variant="introCaption"
                  color={n === step ? 'redesign.primaryText' : 'redesign.secondary'}
                >
                  {t(`placeWizard.step${n}`)}
                </Text>
                <Text variant="introCaption">
                  {t(
                    n < step && stepValid(form, n)
                      ? 'placeWizard.complete'
                      : n === step
                        ? 'placeWizard.current'
                        : n === 3
                          ? 'placeWizard.photoBonus'
                          : n === 2
                            ? 'placeWizard.experience'
                            : 'placeWizard.mandatory',
                  )}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.body}>
          <View style={[styles.heading, styles.stepHeading]}>
            <Text variant="introSmall" color="redesign.primaryText" style={styles.stepNumber}>
              {step}
            </Text>
            <Text variant="introHeading" style={styles.headingText}>
              {t(`placeWizard.heading${step as 1 | 2 | 3}`)}
            </Text>
            {step === 3 ? (
              reward(20, true)
            ) : (
              <Text variant="introCaption" color="redesign.primaryText" style={styles.tag}>
                {t(
                  step === 2
                    ? 'placeWizard.experience'
                    : stepValid(form, 1)
                      ? 'placeWizard.filled'
                      : 'placeWizard.mandatory',
                )}
              </Text>
            )}
          </View>
          {!online ? <Text color="status.warningText">{t('placeWizard.offline')}</Text> : null}
          {taxonomies.isPending ? <Text>{t('common.loading')}</Text> : null}
          {taxonomies.isError || (!taxonomies.isPending && !taxonomyReady) ? (
            <View>
              <Text color="status.warningText">{t('placeWizard.taxonomyUnavailable')}</Text>
              <GhostBtn
                label={t('common.retry')}
                disabled={disabled}
                onPress={() => {
                  void taxonomies.refetch()
                }}
              />
            </View>
          ) : null}
          {!validKeys ? (
            <View>
              <Text color="status.warningText">{t('placeWizard.staleKeys')}</Text>
              <GhostBtn
                label={t('placeWizard.clearStale')}
                disabled={disabled}
                onPress={() => {
                  setValue(
                    'purposeKeys',
                    form.purposeKeys.filter((k) => purposes.includes(k)),
                  )
                  setValue(
                    'vibeKeys',
                    form.vibeKeys.filter((k) => vibes.includes(k)),
                  )
                  setValue(
                    'amenities',
                    Object.fromEntries(Object.entries(form.amenities).filter(([k]) => amenities.includes(k))),
                  )
                  setValue(
                    'serviceChips',
                    form.serviceChips.filter((k) => ratingOptions.includes(k) && !!labels.checkin_tag?.[k]),
                  )
                  setValue(
                    'spaceChips',
                    form.spaceChips.filter((k) => ratingOptions.includes(k) && !!labels.checkin_tag?.[k]),
                  )
                }}
              />
            </View>
          ) : null}
          {step === 1 ? (
            <>
              <View style={styles.section}>
                {sectionTitle(t('placeWizard.price'), 'payments')}
                <Text variant="introCaption" color="redesign.secondary">
                  {t('placeWizard.priceHelp')}
                </Text>
                <View style={styles.priceGrid}>
                  {(['under50', '50to100', '100to200', 'over200'] as const).map((range, index) => {
                    const min = ['0', '50000', '100000', '200001'][index]!
                    const selected = form.priceKnown && form.min === min && form.unit === 'per_person'
                    return (
                      <Pressable
                        key={range}
                        accessibilityRole="button"
                        accessibilityLabel={t(`placeWizard.${range}`)}
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled}
                        style={[styles.priceOption, selected && styles.selectedPrice]}
                        onPress={() => {
                          setValue('priceKnown', !selected)
                          setValue('unit', 'per_person')
                          setValue('min', min)
                          setValue('max', ['49999', '100000', '200000', ''][index]!)
                        }}
                      >
                        {selected ? (
                          <MaterialIcon name="check" size={15} color="redesign.primaryText" />
                        ) : null}
                        <Text variant="introSmall">{t(`placeWizard.${range}`)}</Text>
                      </Pressable>
                    )
                  })}
                </View>
                {form.priceKnown && form.min === '200001'
                  ? textField('max', t('placeWizard.max'), 16, true)
                  : null}
                {!priceValid(form) ? (
                  <Text color="status.dangerText">{t('placeWizard.priceInvalid')}</Text>
                ) : null}
              </View>
              <View style={[styles.section, styles.divider]}>
                {sectionTitle(t('placeWizard.purposes'), 'target', t('placeWizard.multiple'))}
                <Text variant="introCaption" color="redesign.secondary">
                  {t('placeWizard.purposesHelp')}
                </Text>
                {choices('purposeKeys', purposes, 10)}
              </View>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <View style={styles.section}>
                {sectionTitle(t('placeWizard.vibes'), 'mood', t('placeWizard.vibeCount'))}
                <Text variant="introCaption">{t('placeWizard.vibesHelp')}</Text>
                {choices('vibeKeys', vibes, 3)}
              </View>
              <View style={[styles.section, styles.divider]}>
                {sectionTitle(t('placeWizard.amenities'), 'activity', t('placeWizard.tick'))}
                <Text variant="introCaption">{t('placeWizard.amenitiesHelp')}</Text>
                {amenityFields
                  .filter((key) => amenities.includes(key))
                  .map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t(`placeWizard.option.${key}`)}
                      accessibilityState={{
                        checked: form.amenities[key] === true,
                        disabled,
                      }}
                      disabled={disabled}
                      onPress={() => {
                        const next = { ...form.amenities }
                        if (next[key]) delete next[key]
                        else next[key] = true
                        setValue('amenities', next)
                      }}
                      style={[styles.amenity, form.amenities[key] && styles.selectedAmenity]}
                    >
                      <MaterialIcon name={amenityIcons[key]} size={18} color="redesign.primaryText" />
                      <Text variant="introSmall" style={styles.amenityLabel}>
                        {t(`placeWizard.option.${key}`)}
                      </Text>
                      <MaterialIcon
                        name={form.amenities[key] ? 'checkbox' : 'checkboxBlank'}
                        color="redesign.primaryText"
                      />
                    </Pressable>
                  ))}
                {!Object.keys(labels.amenity ?? {}).some((key) =>
                  (amenityFields as readonly string[]).includes(key),
                ) ? (
                  <Text>{t('placeWizard.amenitiesUnavailable')}</Text>
                ) : null}
              </View>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <View style={styles.section}>
                {sectionTitle(t('placeWizard.photos'), 'receipt', t('placeWizard.optional'))}
                {reward(20, true)}
                <Text variant="introCaption" color="redesign.secondary">
                  {t('placeWizard.photosHelp')}
                </Text>
                <GhostBtn
                  label={t('placeWizard.uploadPhotos')}
                  disabled
                  onPress={() => {}}
                  leadingIcon="camera"
                  accessibilityHint={t('placeWizard.photosBlocked')}
                  style={styles.photo}
                />
                <Text variant="introCaption" color="redesign.secondary">
                  {t('placeWizard.photosBlocked')}
                </Text>
              </View>
              <View style={[styles.section, styles.divider]}>
                {sectionTitle(t('placeWizard.tipsHeading'), 'tips', t('placeWizard.optional'))}
                <Text variant="introCaption" color="redesign.secondary">
                  {t('placeWizard.tipsHelp')}
                </Text>
                {textField(
                  'visitTips',
                  t('placeWizard.tipsHeading'),
                  2000,
                  false,
                  t('placeWizard.tipsPlaceholder'),
                )}
              </View>
              <View style={[styles.section, styles.divider]}>
                {sectionTitle(t('placeWizard.ratings'), 'reviews', t('placeWizard.optional'))}
                {rating()}
              </View>
            </>
          ) : null}
          <View style={styles.navigation}>
            {step > 1 ? (
              <GhostBtn
                label={t('common.back')}
                leadingIcon="arrowBack"
                disabled={busy}
                onPress={() => move(step - 1)}
                style={styles.back}
              />
            ) : null}
            <Text variant="introCaption">{t('placeWizard.stepCount', { step })}</Text>
            {step < 3 ? (
              <PrimaryBtn
                label={t('placeWizard.next', { step: step + 1 })}
                variant="discovery"
                disabled={disabled || !stepValid(form, step) || !taxonomyReady || !validKeys}
                onPress={() => move(step + 1)}
                style={styles.next}
              />
            ) : (
              <PrimaryBtn
                label={t('placeWizard.finish')}
                icon="check"
                variant="discovery"
                disabled={disabled || blocked || !complete || !taxonomyReady || !validKeys}
                onPress={() => {
                  if (complete) onSubmit(complete)
                }}
                style={styles.next}
              />
            )}
          </View>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('placeImport.submit')}
        accessibilityHint={blocked ? t('placeImport.notYetOpen') : undefined}
        accessibilityState={{ disabled: submitDisabled, busy: submitting }}
        disabled={submitDisabled}
        style={({ pressed }) => [styles.submit, submitDisabled && styles.disabled, pressed && styles.pressed]}
        onPress={() => {
          if (complete) onSubmit(complete)
        }}
      >
        {submitting ? (
          <ActivityIndicator color={theme.redesign.white} />
        ) : (
          <MaterialIcon name="send" color="redesign.white" />
        )}
        <Text variant="introHeading" color="redesign.white" style={styles.headingText}>
          {t('placeImport.submit')}
        </Text>
        {reward(50, true)}
      </Pressable>
      <GhostBtn
        label={t('placeWizard.save')}
        icon="bookmark"
        loading={save.isPending}
        disabled={
          disabled ||
          !registered ||
          needsReload ||
          !priceValid(form) ||
          !validKeys ||
          drafts.isPending ||
          drafts.isError ||
          (!saved && existing.length > 0)
        }
        onPress={() => {
          void saveDraft()
        }}
        style={styles.draft}
      />
      {!registered ? <Text variant="introCaption">{t('placeWizard.signInDraft')}</Text> : null}
      {registered && drafts.isPending ? <Text>{t('common.loading')}</Text> : null}
      {registered && drafts.isError ? (
        <View>
          <Text color="status.warningText">{t('placeWizard.draftsUnavailable')}</Text>
          <GhostBtn
            label={t('common.retry')}
            disabled={disabled}
            onPress={() => {
              void drafts.refetch()
            }}
          />
        </View>
      ) : null}
      {registered
        ? existing.map((draft) => (
            <View key={draft.id} style={styles.note}>
              <Text variant="introSmall">{t('placeWizard.existingDraft')}</Text>
              <GhostBtn
                label={t('placeWizard.resume')}
                disabled={disabled}
                onPress={() => {
                  void load(draft)
                }}
              />
              <GhostBtn
                label={t('placeWizard.delete')}
                disabled={disabled}
                onPress={() => {
                  void deleteDraft(saved?.id === draft.id ? saved : draft)
                }}
              />
            </View>
          ))
        : null}
      {needsReload && draftId && !existing.some((d) => d.id === draftId) ? (
        <GhostBtn
          label={t('placeWizard.resume')}
          disabled={disabled}
          onPress={() => {
            void load({ id: draftId! })
          }}
        />
      ) : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          color={message === 'saved' || message === 'deleted' ? 'status.successText' : 'status.dangerText'}
        >
          {t(`placeWizard.draft.${message}`)}
        </Text>
      ) : null}
      <View style={styles.note}>
        <View style={styles.heading}>
          <MaterialIcon name="verified" color="redesign.secondary" />
          <Text variant="introLabel">{t('placeWizard.moderationTitle')}</Text>
        </View>
        <Text variant="introCaption" color="redesign.secondary">
          {t('placeWizard.moderationNote')}
        </Text>
      </View>
    </View>
  )
}
