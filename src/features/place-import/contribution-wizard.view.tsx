import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import {
  discoveryLabels,
  isApiError,
  newIdempotencyKey,
  useContributionDrafts,
  useContributionCredits,
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
  priceUnits,
  priceValid,
  resumeContribution,
  stepValid,
  submissionEnrichment,
  type ContributionDraft,
  type ContributionForm,
  type Enrichment,
} from './contribution-form'
import { styles } from './contribution-wizard.style'

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
  const { control, setValue, reset } = useForm<ContributionForm>({ defaultValues: emptyContribution() })
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
  const taxonomies = useTaxonomies({ kinds: 'suitability,mood,amenity,checkin_tag' })
  const labels = discoveryLabels(taxonomies.data, i18n.language)
  const credits = useContributionCredits(registered)
  const drafts = useContributionDrafts(registered)
  const save = useSaveContributionDraft()
  const read = useReadContributionDraft()
  const remove = useDeleteContributionDraft()
  const busy = submitting || save.isPending || read.isPending || remove.isPending
  const disabled = busy || !online
  const existing = drafts.data?.items.filter((d) => d.googlePlaceId === googlePlaceId) ?? []
  const taxonomyReady =
    !taxonomies.isPending &&
    !taxonomies.isError &&
    !!labels.suitability &&
    Object.keys(labels.suitability).length > 0 &&
    !!labels.mood &&
    Object.keys(labels.mood).length > 0
  const validKeys =
    form.purposeKeys.every((k) => !!labels.suitability?.[k]) &&
    form.vibeKeys.every((k) => !!labels.mood?.[k]) &&
    Object.keys(form.amenities).every((k) => !!labels.amenity?.[k]) &&
    form.serviceChips.every((k) => k.startsWith('service_') && !!labels.checkin_tag?.[k]) &&
    form.spaceChips.every((k) => k.startsWith('space_') && !!labels.checkin_tag?.[k])

  function choices(
    kind: string,
    field: 'purposeKeys' | 'vibeKeys' | 'serviceChips' | 'spaceChips',
    max: number,
    prefix = '',
  ) {
    return (
      <View style={styles.row}>
        {Object.entries(labels[kind] ?? {})
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, label]) => {
            const selected = form[field].includes(key)
            const unavailable =
              disabled ||
              (field === 'serviceChips' && !form.serviceRating) ||
              (field === 'spaceChips' && !form.spaceRating)
            return (
              <Chip
                key={key}
                label={label}
                appearance="mood"
                variant={
                  unavailable || (!selected && form[field].length >= max)
                    ? 'disabled'
                    : selected
                      ? 'selected'
                      : 'default'
                }
                onPress={() => setValue(field, selected ? form[field].filter((k) => k !== key) : [...form[field], key])}
              />
            )
          })}
      </View>
    )
  }

  function textField(
    field: 'min' | 'max' | 'recommendedDishes' | 'visitTips',
    label: string,
    maxLength: number,
    numeric = false,
  ) {
    return (
      <FieldFocusGroup style={styles.field}>
        <Text variant="introSmall" color="redesign.secondary">
          {label}
        </Text>
        <TextInput
          accessibilityLabel={label}
          value={form[field]}
          editable={!disabled}
          onChangeText={(value) => setValue(field, value)}
          onFocus={onFocus}
          keyboardType={numeric ? 'number-pad' : 'default'}
          multiline={!numeric}
          maxLength={maxLength}
          placeholderTextColor={theme.redesign.secondary}
          style={[styles.input, !numeric && styles.multiline]}
        />
      </FieldFocusGroup>
    )
  }

  function rating(kind: 'service' | 'space') {
    const field = kind === 'service' ? 'serviceRating' : 'spaceRating'
    return (
      <View style={styles.section}>
        <Text variant="introLabel">{t(`placeWizard.${kind}`)}</Text>
        <View style={styles.row}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={t('placeWizard.stars', { category: t(`placeWizard.${kind}`), count: value })}
              accessibilityState={{ checked: form[field] === value, disabled }}
              disabled={disabled}
              onPress={() => setValue(field, value)}
              style={[styles.star, form[field] >= value && styles.starSelected]}
            >
              <MaterialIcon
                name="star"
                size={26}
                color={form[field] >= value ? 'redesign.primaryText' : 'redesign.outline'}
              />
            </Pressable>
          ))}
        </View>
        {choices('checkin_tag', kind === 'service' ? 'serviceChips' : 'spaceChips', 5, `${kind}_`)}
      </View>
    )
  }

  function fail(error: unknown) {
    const conflict = isApiError(error) && error.code === 'DRAFT_MODIFIED'
    setNeedsReload(conflict)
    setMessage(conflict ? 'conflict' : isApiError(error) && error.code === 'DRAFT_LIMIT_REACHED' ? 'limit' : 'failed')
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
        body: { googlePlaceId, expectedVersion: saved?.version ?? 0, enrichment: draftEnrichment(form) },
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
  const complete = submissionEnrichment(form)
  return (
    <View testID="contribution-wizard" style={styles.root}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <MaterialIcon name="editNote" color="redesign.primaryText" />
            <Text variant="introHeading" style={styles.headingText}>
              {t('placeWizard.title')}
            </Text>
            {registered && !credits.isError && typeof credits.data?.creditBalance === 'number' ? (
              <Text variant="introCaption" color="redesign.primaryText">
                {t('placeWizard.creditBalance', { count: credits.data.creditBalance })}
              </Text>
            ) : null}
          </View>
          <View style={styles.progress}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={styles.progressItem}
                accessibilityLabel={t('placeWizard.progress', {
                  step: n,
                  status: t(
                    stepValid(form, n)
                      ? 'placeWizard.complete'
                      : n === step
                        ? 'placeWizard.current'
                        : 'placeWizard.pending',
                  ),
                })}
              >
                <View
                  style={[
                    styles.progressLine,
                    stepValid(form, n) ? styles.completeLine : n === step && styles.currentLine,
                  ]}
                />
                <Text variant="introCaption" color={n === step ? 'redesign.primaryText' : 'redesign.secondary'}>
                  {t(`placeWizard.step${n}`)}
                </Text>
                <Text variant="introCaption">
                  {t(
                    stepValid(form, n)
                      ? 'placeWizard.complete'
                      : n === step
                        ? 'placeWizard.current'
                        : 'placeWizard.pending',
                  )}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.body}>
          <Text variant="introHeading">{t(`placeWizard.heading${step as 1 | 2 | 3}`)}</Text>
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
                    form.purposeKeys.filter((k) => !!labels.suitability?.[k]),
                  )
                  setValue(
                    'vibeKeys',
                    form.vibeKeys.filter((k) => !!labels.mood?.[k]),
                  )
                  setValue(
                    'amenities',
                    Object.fromEntries(Object.entries(form.amenities).filter(([k]) => !!labels.amenity?.[k])),
                  )
                  setValue(
                    'serviceChips',
                    form.serviceChips.filter((k) => k.startsWith('service_') && !!labels.checkin_tag?.[k]),
                  )
                  setValue(
                    'spaceChips',
                    form.spaceChips.filter((k) => k.startsWith('space_') && !!labels.checkin_tag?.[k]),
                  )
                }}
              />
            </View>
          ) : null}
          {step === 1 ? (
            <>
              <View style={styles.section}>
                <Text variant="introLabel">{t('placeWizard.price')}</Text>
                <Text variant="introCaption" color="redesign.secondary">
                  {t('placeWizard.priceHelp')}
                </Text>
                <View style={styles.row}>
                  <Chip
                    label={t('placeWizard.unknownPrice')}
                    appearance="mood"
                    variant={!form.priceKnown ? 'selected' : disabled ? 'disabled' : 'default'}
                    onPress={() => {
                      if (!disabled) setValue('priceKnown', false)
                    }}
                  />
                  {(['under50', '50to100', '100to200', 'over200'] as const).map((range, index) => (
                    <Chip
                      key={range}
                      label={t(`placeWizard.${range}`)}
                      appearance="mood"
                      variant={disabled ? 'disabled' : 'default'}
                      onPress={() => {
                        setValue('priceKnown', true)
                        setValue('unit', 'per_person')
                        setValue('min', ['0', '50000', '100000', '200001'][index]!)
                        setValue('max', ['49999', '100000', '200000', ''][index]!)
                      }}
                    />
                  ))}
                </View>
                <GhostBtn
                  label={t('placeWizard.enterPrice')}
                  disabled={disabled}
                  onPress={() => setValue('priceKnown', true)}
                />
                {form.priceKnown ? (
                  <>
                    <View style={styles.row}>
                      {priceUnits.map((unit) => (
                        <Chip
                          key={unit}
                          appearance="mood"
                          label={t(`placeWizard.unit.${unit}`)}
                          variant={disabled ? 'disabled' : form.unit === unit ? 'selected' : 'default'}
                          onPress={() => setValue('unit', unit)}
                        />
                      ))}
                    </View>
                    {form.unit !== 'free' ? (
                      <View style={styles.row}>
                        {textField('min', t('placeWizard.min'), 16, true)}
                        {textField('max', t('placeWizard.max'), 16, true)}
                      </View>
                    ) : null}
                  </>
                ) : null}
                {!priceValid(form) ? <Text color="status.dangerText">{t('placeWizard.priceInvalid')}</Text> : null}
              </View>
              <View style={[styles.section, styles.divider]}>
                <Text variant="introLabel">{t('placeWizard.purposes')}</Text>
                <Text variant="introCaption">{t('placeWizard.purposesHelp')}</Text>
                {choices('suitability', 'purposeKeys', 10)}
              </View>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <View style={styles.section}>
                <Text variant="introLabel">{t('placeWizard.vibes')}</Text>
                <Text variant="introCaption">{t('placeWizard.vibesHelp')}</Text>
                {choices('mood', 'vibeKeys', 3)}
              </View>
              <View style={[styles.section, styles.divider]}>
                <Text variant="introLabel">{t('placeWizard.amenities')}</Text>
                <Text variant="introCaption">{t('placeWizard.amenitiesHelp')}</Text>
                {amenityFields
                  .filter((key) => labels.amenity?.[key])
                  .map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="checkbox"
                      accessibilityLabel={labels.amenity![key]}
                      accessibilityState={{ checked: form.amenities[key] === true, disabled }}
                      disabled={disabled}
                      onPress={() => {
                        const next = { ...form.amenities }
                        if (next[key]) delete next[key]
                        else next[key] = true
                        setValue('amenities', next)
                      }}
                      style={[styles.amenity, form.amenities[key] && styles.selectedAmenity]}
                    >
                      <Text variant="introSmall" style={styles.amenityLabel}>
                        {labels.amenity![key]}
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
                <Text variant="introLabel">{t('placeWizard.photos')}</Text>
                <Text variant="introCaption">{t('placeWizard.photosHelp')}</Text>
                <GhostBtn
                  label={t('placeWizard.uploadPhotos')}
                  disabled
                  onPress={() => {}}
                  accessibilityHint={t('placeWizard.photosBlocked')}
                  style={styles.photo}
                />
                <Text variant="introCaption" color="redesign.secondary">
                  {t('placeWizard.photosBlocked')}
                </Text>
              </View>
              <View style={[styles.section, styles.divider]}>
                <Text variant="introLabel">{t('placeWizard.tipsHeading')}</Text>
                {textField('recommendedDishes', t('placeWizard.dishes'), 1000)}
                {textField('visitTips', t('placeWizard.tips'), 2000)}
              </View>
              <View style={[styles.section, styles.divider]}>
                <Text variant="introLabel">{t('placeWizard.ratings')}</Text>
                {rating('service')}
                {rating('space')}
              </View>
            </>
          ) : null}
          <View style={styles.navigation}>
            <GhostBtn
              label={t('common.back')}
              disabled={busy}
              onPress={() => (step === 1 ? onBack() : move(step - 1))}
            />
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
              <Text variant="introCaption">{t(complete ? 'placeWizard.ready' : 'placeWizard.ratingsRequired')}</Text>
            )}
          </View>
        </View>
      </View>
      <PrimaryBtn
        label={t('placeImport.submit')}
        variant="discovery"
        icon="send"
        accessibilityHint={blocked ? t('placeImport.notYetOpen') : undefined}
        loading={submitting}
        disabled={disabled || blocked || !complete || !taxonomyReady || !validKeys}
        onPress={() => {
          if (complete) onSubmit(complete)
        }}
      />
      {!complete ? <Text variant="introCaption">{t('placeWizard.required')}</Text> : null}
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
