import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import {
  isApiError,
  newIdempotencyKey,
  useContributionDrafts,
  useDeleteContributionDraft,
  useReadContributionDraft,
  useSaveContributionDraft,
  useTaxonomies,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { GhostBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { FieldFocusGroup } from '@/shared/ui/field-focus-group'
import {
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
import { taxonomyOptions } from './contribution-options'
import { ContributionChoices } from './contribution-choices.view'
import { styles } from './contribution-wizard.style'

export function ContributionWizard({
  ref,
  googlePlaceId,
  registered,
  online,
  submitting,
  blocked,
  onSubmit,
  onBack,
  onFocus,
}: {
  ref?: Ref<{ saveDraft: () => void }>
  googlePlaceId: string
  registered: boolean
  online: boolean
  submitting: boolean
  blocked: boolean
  onSubmit: (enrichment: Enrichment) => void
  onBack: () => void
  onFocus: () => void
}) {
  const { t } = useTranslation()
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
  const drafts = useContributionDrafts(registered)
  const save = useSaveContributionDraft()
  const read = useReadContributionDraft()
  const remove = useDeleteContributionDraft()
  const busy = submitting || save.isPending || read.isPending || remove.isPending
  const disabled = busy || !online
  const [missingDraftIds, setMissingDraftIds] = useState<string[]>([])
  const draftListMissing = drafts.isError && isApiError(drafts.error) && drafts.error.status === 404
  const existing = draftListMissing ? [] : drafts.data?.items.filter((d) =>
    d.googlePlaceId === googlePlaceId && !missingDraftIds.includes(d.id)) ?? []
  useEffect(() => {
    if (registered && drafts.isError) reportDraftReadFailure(drafts.error, 'list')
  }, [registered, drafts.isError, drafts.error])
  const purposes = taxonomyOptions(taxonomies.data, 'suitability')
  const vibes = taxonomyOptions(taxonomies.data, 'mood')
  const amenities = taxonomyOptions(taxonomies.data, 'amenity')
  const ratings = taxonomyOptions(taxonomies.data, 'checkin_tag')
  const includes = (options: typeof purposes, key: string) => options.some((option) => option.key === key)
  const taxonomyReady = !taxonomies.isPending && !taxonomies.isError && purposes.length > 0 && vibes.length > 0
  const validSelection = (keys: string[], options: typeof purposes, max: number) =>
    keys.length <= max && new Set(keys).size === keys.length && keys.every((key) => includes(options, key))
  const validKeys =
    validSelection(form.purposeKeys, purposes, 10) &&
    validSelection(form.vibeKeys, vibes, 3) &&
    Object.keys(form.amenities).length <= 6 &&
    Object.keys(form.amenities).every((key) => includes(amenities, key)) &&
    validSelection(form.serviceChips, ratings, 5) && validSelection(form.spaceChips, ratings, 5)

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
  function reward() {
    return (
      <View style={styles.reward} accessible accessibilityLabel={t('placeResult.credit')}>
        <MaterialIcon name="sparkle" size={14} color="redesign.white" />
        <Text variant="introCaption" color="redesign.white" numberOfLines={1}>
          {t('placeWizard.rewardCompact', { amount: 50 })}
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
      if (mounted.current) {
        reportDraftReadFailure(error, 'resume')
        if (isApiError(error) && error.status === 404) {
          setMissingDraftIds((ids) => [...ids, draft.id])
          if (draft.id === draftId || draft.id === saved?.id) {
            setSaved(null)
            setDraftId(null)
            setNeedsReload(false)
            setMessage(null)
          }
        }
      }
    } finally {
      lock.current = false
    }
  }
  async function saveDraft() {
    if (lock.current || disabled || !registered || needsReload || !priceValid(form) || !validKeys || drafts.isPending || (!saved && existing.length > 0)) return
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
          enrichment: draftEnrichment(form),
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
      setMissingDraftIds((ids) => [...ids, draft.id])
      if (saved?.id === draft.id) {
        // Deleting a draft expires its uploads; retain only the other form inputs.
        setValue('photos', undefined)
        setValue('billPhotoPublicConsent', undefined)
        setSaved(null)
        setDraftId(null)
        setNeedsReload(false)
      }
      setMessage('deleted')
      track('place_contribution_draft_deleted')
    } catch (error) {
      if (mounted.current) {
        setNeedsReload(isApiError(error) && error.code === 'DRAFT_MODIFIED')
        track('place_contribution_draft_delete_failed', {
          status: isApiError(error) ? error.status : 0,
        })
      }
    } finally {
      lock.current = false
    }
  }
  useImperativeHandle(ref, () => ({ saveDraft: () => { void saveDraft() } }))

  function move(next: number) {
    setStep(next)
    track('place_contribution_step_viewed', { step: next })
  }
  const complete = submissionEnrichment(form)
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
            {reward()}
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
            {step !== 3 ? (
              <Text variant="introCaption" color="redesign.primaryText" style={styles.tag}>
                {t(
                  step === 2
                    ? 'placeWizard.experience'
                    : stepValid(form, 1)
                      ? 'placeWizard.filled'
                      : 'placeWizard.mandatory',
                )}
              </Text>
            ) : null}
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
                    form.purposeKeys.filter((k) => includes(purposes, k)),
                  )
                  setValue(
                    'vibeKeys',
                    form.vibeKeys.filter((k) => includes(vibes, k)),
                  )
                  setValue(
                    'amenities',
                    Object.fromEntries(Object.entries(form.amenities).filter(([k]) => includes(amenities, k))),
                  )
                  setValue(
                    'serviceChips',
                    form.serviceChips.filter((k) => includes(ratings, k)),
                  )
                  setValue(
                    'spaceChips',
                    form.spaceChips.filter((k) => includes(ratings, k)),
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
                <ContributionChoices options={purposes} selected={form.purposeKeys} max={10} disabled={disabled}
                  title={t('placeWizard.purposes')} onChange={(keys) => setValue('purposeKeys', keys)} />
              </View>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <View style={styles.section}>
                {sectionTitle(t('placeWizard.vibes'), 'mood', t('placeWizard.vibeCount'))}
                <Text variant="introCaption">{t('placeWizard.vibesHelp')}</Text>
                <ContributionChoices options={vibes} selected={form.vibeKeys} max={3} disabled={disabled}
                  title={t('placeWizard.vibes')} onChange={(keys) => setValue('vibeKeys', keys)} />
              </View>
              <View style={[styles.section, styles.divider]}>
                {sectionTitle(t('placeWizard.amenities'), 'activity', t('placeWizard.tick'))}
                <Text variant="introCaption">{t('placeWizard.amenitiesHelp')}</Text>
                <ContributionChoices options={amenities} selected={Object.keys(form.amenities).filter((key) => form.amenities[key])}
                  checklist max={6} disabled={disabled} title={t('placeWizard.amenities')}
                  onChange={(keys) => setValue('amenities', Object.fromEntries([
                    ...Object.entries(form.amenities).filter(([, value]) => value === false),
                    ...keys.map((key) => [key, true] as const),
                  ]))} />
              </View>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <View style={styles.section}>
                {sectionTitle(t('placeWizard.photos'), 'receipt', t('placeWizard.optional'))}
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
                <ContributionChoices options={ratings} selected={[...new Set([...form.serviceChips, ...form.spaceChips])]}
                  max={5} disabled={disabled || !form.serviceRating || !form.spaceRating} title={t('placeWizard.ratings')}
                  onChange={(keys) => { setValue('serviceChips', keys); setValue('spaceChips', keys) }} />
              </View>
            </>
          ) : null}
          <View style={styles.navigation}>
            {step > 1 ? (
              <GhostBtn
                label={t('common.back')}
                disabled={busy}
                onPress={() => move(step - 1)}
                style={styles.back}
              />
            ) : null}
            {step < 3 ? (
              <PrimaryBtn
                label={t('placeWizard.next')}
                disabled={disabled || !stepValid(form, step) || !taxonomyReady || !validKeys}
                onPress={() => move(step + 1)}
                style={styles.next}
              />
            ) : (
              <PrimaryBtn
                label={t('placeImport.submit')}
                accessibilityHint={blocked ? t('placeImport.notYetOpen') : undefined}
                loading={submitting}
                leadingIcon="send"
                disabled={submitDisabled}
                onPress={() => {
                  if (complete) onSubmit(complete)
                }}
                style={styles.next}
              />
            )}
          </View>
        </View>
      </View>
      <SecondaryBtn
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
          (!saved && existing.length > 0)
        }
        onPress={() => {
          void saveDraft()
        }}
        style={styles.action}
      />
      {!registered ? <Text variant="introCaption">{t('placeWizard.signInDraft')}</Text> : null}
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

// Expected absence (including an undeployed endpoint) is silent. Telemetry never
// includes server messages, place IDs, draft IDs, or contribution content.
function reportDraftReadFailure(error: unknown, operation: 'list' | 'resume') {
  if (isApiError(error) && error.status === 404) return
  track('place_contribution_draft_read_failed', {
    operation,
    status: isApiError(error) ? error.status : 0,
  })
}
