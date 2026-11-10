import { BlockingLoadingOverlay, useSubmitOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { Chip } from '@/shared/ui/chip.view'
import { useImperativeHandle, useState, type Ref, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useTaxonomies } from '@/shared/api'
import { track } from '@/shared/analytics'
import { GhostBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { FieldFocusGroup } from '@/shared/ui/field-focus-group'
import {
  priceValid,
  stepValid,
  submissionEnrichment,
  type ContributionForm,
  type Enrichment,
} from './contribution-form'
import { taxonomyOptions } from './contribution-options'
import { ContributionChoices } from './contribution-choices.view'
import { styles } from './contribution-wizard.style'
import { ImportFlowProvider, useOptionalImportFlow, useImportFlow } from './import-flow-controller'
import { acknowledgementValid, contributionFeedbackKey, foregroundBusy, serializeFlow, writesAllowed } from './import-flow'

type WizardProps = {
  ref?: Ref<{ saveDraft: () => Promise<boolean> }>
  googlePlaceId: string
  registered: boolean
  online: boolean
  submitting: boolean
  blocked: boolean
  onSubmit: (enrichment: Enrichment) => void
  onBack: () => void
  onFocus: () => void
  hideActions?: boolean
  feedbackSuppressed?: boolean
}

function useWizardModel({ googlePlaceId, registered, online, submitting, blocked }: WizardProps) {
  const { t } = useTranslation()
  const { controller, state } = useImportFlow()
  const form = state.fields
  const step = state.step
  const taxonomies = useTaxonomies({ kinds: 'suitability,mood,amenity,checkin_tag' })
  const busy = submitting || foregroundBusy(state)
  const disabled = busy || !online || ['retiring', 'completed', 'submissionUnknown'].includes(state.phase)
  const existing = state.list.filter(d => d.googlePlaceId === googlePlaceId && !state.tombstones.includes(d.id))
  const activeId = state.draft?.id ?? state.pendingCreate?.id
  const needsDraftChoice = !activeId && existing.length > 0 && !state.newDraftChosen
  const canSave = !disabled && registered && writesAllowed(state) && priceValid(form) && !state.listLoading
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

  async function saveDraft() {
    if (!canSave || !validKeys || needsDraftChoice) return false
    await controller.save()
    const saved = controller.getSnapshot()
    return !!saved.draft && saved.message === 'saved' && !saved.dirty
  }
  function move(next: number) {
    controller.move(next)
    track('place_contribution_step_viewed', { step: next })
  }
  const complete = submissionEnrichment(form) ? serializeFlow(state) as Enrichment : undefined
  const submitDisabled = disabled || blocked || !complete || !taxonomyReady || !validKeys || !writesAllowed(state) || !!state.pendingCreate?.uncertain
  return { t, controller, state, form, step, taxonomies, busy, disabled, existing, activeId,
    needsDraftChoice, canSave, purposes, vibes, amenities, ratings, taxonomyReady, validKeys, includes,
    saveDraft, move, complete, submitDisabled }
}

function WizardActionRow({ model, onSubmit, submitting, blocked }: {
  model: ReturnType<typeof useWizardModel>
} & Pick<WizardProps, 'onSubmit' | 'submitting' | 'blocked'>) {
  const { t, state, step, busy, disabled, canSave, validKeys, needsDraftChoice, taxonomyReady,
    form, saveDraft, move, complete, submitDisabled } = model
  return <SheetActions>
    {step > 1 ? <GhostBtn style={styles.action} label={t('common.back')} disabled={busy} onPress={() => move(step - 1)} /> : null}
    <SecondaryBtn style={styles.action} label={t('placeWizard.save')} loading={state.phase === 'saving'}
      disabled={!canSave || !validKeys || needsDraftChoice} onPress={() => { void saveDraft() }} />
    {step < 3 ? <PrimaryBtn style={styles.action} label={t('placeWizard.next')}
      disabled={disabled || !stepValid(form, step) || !taxonomyReady || !validKeys} onPress={() => move(step + 1)} />
      : <PrimaryBtn style={styles.action} label={t('placeImport.submit')} accessibilityHint={blocked ? t('placeImport.notYetOpen') : undefined}
        loading={submitting} disabled={submitDisabled} onPress={() => { if (complete) onSubmit(complete) }} />}
  </SheetActions>
}

/** Mounted beside the screen scroll view; both adapters read the same flow controller. */
export function ContributionWizardActionBar(props: WizardProps) {
  const model = useWizardModel(props)
  return <GlassBar placement="docked" testID="contribution-action-bar">
    <WizardActionRow model={model} {...props} />
  </GlassBar>
}

function Wizard(props: WizardProps) {
  const { ref, registered, online, onFocus, hideActions, feedbackSuppressed } = props
  const model = useWizardModel(props)
  const { t, controller, state, step, taxonomies, busy, disabled, existing, activeId,
    purposes, vibes, amenities, ratings, taxonomyReady, validKeys, includes, saveDraft } = model
  const { theme } = useUnistyles()
  const { control } = useForm<ContributionForm>({ defaultValues: state.fields, values: state.fields })
  const form = useWatch({ control }) as ContributionForm
  const [tipsHeight, setTipsHeight] = useState(88)
  const setValue = <K extends keyof ContributionForm>(key: K, value: ContributionForm[K]) => controller.edit({ [key]: value })
  useImperativeHandle(ref, () => ({ saveDraft }))
  // Include operation/revision so a second save of unchanged fields still reports its result.
  const successFeedback = ['saved', 'resumed', 'deleted'].includes(state.message)
  const feedbackKey = contributionFeedbackKey(state)
  const [dismissedFeedback, dismissFeedback] = useState<string | null>(null)
  const overlay = useSubmitOverlay(state.phase === 'saving')
  const feedbackVisible = overlay.closed && state.message !== 'newDraft' && !busy && !state.resultVisible
    && !feedbackSuppressed && dismissedFeedback !== feedbackKey

  function sectionTitle(title: string, icon: Parameters<typeof MaterialIcon>[0]['name'], tag?: string, action?: ReactNode) {
    return (
      <View style={styles.heading}>
        <MaterialIcon name={icon} size={18} color="accent.primary" />
        <View style={[styles.headingText, icon === 'mood' && styles.vibeHeadingText]}>
          {action ? <View style={styles.titleRow}>
            <Text testID={`contribution-section-title-${icon}`} variant="introHeading" numberOfLines={1} style={styles.sectionTitle}>{title}</Text>
            {action}
          </View> : <Text testID={`contribution-section-title-${icon}`} variant="introHeading" numberOfLines={1}>{title}</Text>}
          {tag ? <Text variant="introCaption" color="text.secondary">{tag}</Text> : null}
        </View>
      </View>
    )
  }
  function reward() {
    return (
      <Chip icon="sparkle" variant="info" label={t('placeWizard.rewardCompact', { amount: 50 })} accessibilityLabel={t('placeResult.credit')} />
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
          <Text variant="introSmall" color="text.secondary">
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
          multiline={field === 'visitTips'}
          scrollEnabled={field === 'visitTips' ? false : undefined}
          onContentSizeChange={field === 'visitTips' ? (event) => setTipsHeight(Math.max(88, Math.ceil(event.nativeEvent.contentSize.height))) : undefined}
          maxLength={maxLength}
          placeholderTextColor={theme.text.secondary}
          style={[styles.input, field === 'visitTips' && [styles.multiline, { height: tipsHeight }]]}
        />
        {field === 'visitTips' ? <Text variant="introCaption" color="text.secondary">
          {t('placeWizard.characterCount', { count: [form.recommendedDishes, form.visitTips].filter(Boolean).join(' — ').length, max: maxLength })}
        </Text> : null}
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
                color={value >= n ? 'status.warningText' : 'text.secondary'}
              />
            </Pressable>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View testID="contribution-wizard" style={styles.root}>
      <BlockingLoadingOverlay visible={state.phase === 'saving'} onClosed={overlay.onClosed} />
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <View style={styles.headerIcon}>
              <MaterialIcon name="editNote" size={18} color="accent.primary" />
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
                  testID={`contribution-progress-title-${n}`}
                  variant="introCaption"
                  numberOfLines={1}
                  color={n === step ? 'accent.primary' : 'text.secondary'}
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
            <Text variant="introSmall" color="accent.primary" style={styles.stepNumber}>
              {step}
            </Text>
            <View style={styles.headingText}>
              <Text testID="contribution-step-title" variant="introHeading" numberOfLines={1}>
                {t(`placeWizard.heading${step as 1 | 2 | 3}`)}
              </Text>
            </View>
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
                <Text variant="introCaption" color="text.secondary">
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
                          <MaterialIcon name="check" size={15} color="accent.primary" />
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
                <Text variant="introCaption" color="text.secondary">
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
                <ContributionChoices options={vibes} selected={form.vibeKeys} max={3} disabled={disabled}
                  checklist renderHeader={(action) => sectionTitle(t('placeWizard.vibes'), 'mood', t('placeWizard.vibeCount'), action)}
                  title={t('placeWizard.vibes')} onChange={(keys) => setValue('vibeKeys', keys)} />
              </View>
              <View style={[styles.section, styles.divider]}>
                <ContributionChoices options={amenities} selected={Object.keys(form.amenities).filter((key) => form.amenities[key])}
                  renderHeader={(action) => sectionTitle(t('placeWizard.amenities'), 'activity', undefined, action)}
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
                <Text variant="introCaption" color="text.secondary">
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
                <Text variant="introCaption" color="text.secondary">
                  {t('placeWizard.photosBlocked')}
                </Text>
              </View>
              <View style={[styles.section, styles.divider]}>
                {sectionTitle(t('placeWizard.tipsHeading'), 'tips', t('placeWizard.optional'))}
                <Text variant="introCaption" color="text.secondary">
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
                <ContributionChoices options={ratings} selected={[...new Set([...form.serviceChips, ...form.spaceChips])]}
                  checklist renderHeader={(action) => <>
                    {sectionTitle(t('placeWizard.ratings'), 'reviews', t('placeWizard.optional'), action)}
                    {rating()}
                  </>}
                  max={5} disabled={disabled || !form.serviceRating || !form.spaceRating} title={t('placeWizard.ratings')}
                  onChange={(keys) => { setValue('serviceChips', keys); setValue('spaceChips', keys) }} />
              </View>
            </>
          ) : null}
        </View>
      </View>
      {!hideActions ? <GlassBar placement="docked" testID="contribution-action-bar">
        <WizardActionRow model={model} {...props} />
      </GlassBar> : null}
      {!registered ? <Text variant="introCaption">{t('placeWizard.signInDraft')}</Text> : null}
      <ResultSheet testID="contribution-feedback" visible={feedbackVisible}
        variant={successFeedback ? 'success' : ['saveUnconfirmed', 'deleteFailed', 'temporarilyUnavailable'].includes(state.message) ? 'error' : 'warning'}
        title={t('placeWizard.title')} body={t(`placeWizard.lifecycle.${state.message}`)}
        primaryAction={{ label: t('common.close'), onPress: () => dismissFeedback(feedbackKey) }}
        onClose={() => dismissFeedback(feedbackKey)} />
      {state.listError ? <View>
        <Text color="status.warningText">{t('placeWizard.lifecycle.draftListUnavailable')}</Text>
        <GhostBtn label={t('placeWizard.lifecycle.retryList')} disabled={disabled}
          onPress={() => { void controller.refreshList() }} />
      </View> : null}
      {state.media.length ? <View>
        <Text>{t('placeWizard.lifecycle.publicPhotos', { count: state.media.length })}</Text>
        <GhostBtn label={t('placeWizard.lifecycle.removePhotos')} disabled={busy}
          onPress={() => controller.setMedia([])} />
        {state.media.some(p => p.kind === 'bill') ? <>
          {!acknowledgementValid(state) ? <>
            <Text color="status.warningText">{t('placeWizard.lifecycle.billAcknowledgementRequired')}</Text>
            <GhostBtn label={t('placeWizard.lifecycle.acknowledge')} disabled={busy || state.phase !== 'editing'}
              onPress={() => controller.acknowledge()} />
          </> : null}
          <GhostBtn label={t('placeWizard.lifecycle.removeBills')} disabled={busy}
            onPress={() => controller.setMedia(state.media.filter(p => p.kind !== 'bill'))} />
        </> : null}
      </View> : null}
      {state.phase === 'mediaRecovery' || state.message === 'draftUnavailable' ? <GhostBtn
        label={t('placeWizard.lifecycle.continueWithoutPhotos')} disabled={busy}
        onPress={() => controller.continueWithoutPhotos()} /> : null}
      {state.phase === 'conflict' ? <GhostBtn label={t('placeWizard.lifecycle.startNew')}
        disabled={disabled || !!state.pendingCreate?.uncertain} onPress={() => controller.startNew()} /> : null}
      {state.pendingCreate?.uncertain ? <GhostBtn label={t('placeWizard.lifecycle.checkSave')}
        disabled={disabled} onPress={() => { void controller.reconcileSave() }} /> : null}
      {state.message === 'deleteFailed' ? <GhostBtn label={t('common.retry')}
        disabled={disabled} onPress={() => { void controller.deleteDraft(state.deleteFailure ?? undefined) }} /> : null}
      {registered && activeId ? <View style={styles.note}>
        <GhostBtn label={t(['conflict', 'mediaRecovery'].includes(state.phase) ? 'placeWizard.lifecycle.reload' : 'placeWizard.resume')}
          disabled={disabled} onPress={() => { void controller.requestResume(state.conflict?.id ?? activeId) }} />
        <GhostBtn label={t('placeWizard.delete')} disabled={disabled || state.phase === 'conflict'}
          onPress={() => { void controller.deleteDraft() }} />
      </View> : null}
      {registered ? existing.filter(d => d.id !== activeId).map(draft => <View key={draft.id} style={styles.note}>
        <Text variant="introSmall">{t('placeWizard.existingDraft')}</Text>
        <GhostBtn label={t('placeWizard.resume')} disabled={disabled}
          onPress={() => { void controller.requestResume(draft.id) }} />
        <GhostBtn label={t('placeWizard.delete')} disabled={disabled}
          onPress={() => { void controller.deleteDraft(draft) }} />
      </View>) : null}
      {state.conflict && state.conflict.id !== activeId && !existing.some(d => d.id === state.conflict?.id) ? <GhostBtn
        label={t('placeWizard.lifecycle.reload')} disabled={disabled}
        onPress={() => { void controller.requestResume(state.conflict!.id) }} /> : null}
      {state.replacement ? <View accessibilityViewIsModal>
        <Text>{t('placeWizard.lifecycle.replaceConfirmation')}</Text>
        <GhostBtn label={t('placeWizard.lifecycle.replace')} disabled={disabled}
          onPress={() => { void controller.confirmReplacement() }} />
        <GhostBtn label={t('common.cancel')} onPress={() => controller.cancelReplacement()} />
      </View> : null}
      <View style={styles.note}>
        <View style={styles.heading}>
          <MaterialIcon name="verified" color="text.secondary" />
          <Text variant="introLabel">{t('placeWizard.moderationTitle')}</Text>
        </View>
        <Text variant="introCaption" color="text.secondary">
          {t('placeWizard.moderationNote')}
        </Text>
      </View>
    </View>
  )
}

// Standalone use (including previews) still gets exactly one controller. The import
// screen provides it above resolution and results, so wizard remounts cannot own it.
export function ContributionWizard(props: Parameters<typeof Wizard>[0]) {
  const flow = useOptionalImportFlow()
  return flow ? <Wizard {...props} /> : <ImportFlowProvider online={props.online} registered={props.registered} initialPlaceId={props.googlePlaceId}>
    <Wizard {...props} />
  </ImportFlowProvider>
}
