import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useMe } from '@/shared/api'
import { track } from '@/shared/analytics'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { useSession } from '@/shared/providers/session-provider'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { useFieldVisibility } from '@/shared/ui/use-field-visibility'
import { Text } from '@/shared/ui/text'
import { DEFAULT_BUDGET_TIER, tierForAmount } from './budget-tiers'
import { BudgetPicker } from './budget-picker.view'
import { budgetPickerSchema } from './budget-picker'
import { WizardScreen } from './wizard-step.view'
import { styles } from './create-budget.style'

export default function CreateBudgetScreen() {
  const { t } = useTranslation()
  const { viewportRef, scrollRef, schedule, onScroll, onScrollBeginDrag, field: visibilityField } = useFieldVisibility('create-budget')
  const router = useRouter()
  const { roomType, budgetMode } = useRoom()
  const unit = roomType === 'couple' ? t('createBudget.unit.couple') : budgetUnitLabel(budgetMode, roomType, t)
  const patchDraft = useRoomStore(state => state.patchDraft)
  const draftBudgetAmount = useRoomStore(state => state.budgetAmount)
  const { status } = useSession()
  const form = useForm({ resolver: zodResolver(budgetPickerSchema), defaultValues: { budgetAmount: draftBudgetAmount ?? DEFAULT_BUDGET_TIER.amount }, mode: 'onChange' })
  const selectedAmount = useWatch({ control: form.control, name: 'budgetAmount' })
  const valid = budgetPickerSchema.safeParse({ budgetAmount: selectedAmount }).success

  // ADR-0022: the profile's usual budget is per person, so it is offered only
  // when this room counts per person, only while the draft holds no amount,
  // and only by a tap — the tiers are the wizard's; the amount is mapped.
  const me = useMe({ enabled: status === 'user' })
  const usual = me.data?.usualBudget ?? null
  const usualTier = usual ? tierForAmount(usual.perPerson) : null
  const offerUsual = usualTier !== null && budgetMode === 'per_person' && draftBudgetAmount === null

  function useUsualBudget() {
    if (!usualTier) return
    form.setValue('budgetAmount', usualTier.amount, { shouldValidate: true })
    patchDraft({ budgetAmount: usualTier.amount })
    track('profile_prefill_used', { field: 'usualBudget' })
  }

  function next(value: { budgetAmount: number }) {
    // The amount is what the API constrains on; the tier key is presentation.
    patchDraft({ budgetAmount: value.budgetAmount })
    router.push('/create/mood')
  }

  // Group budget carries its scope explicitly — no couple copy on group flows.
  const subtitle =
    roomType === 'group'
      ? t(budgetMode === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal')
      : t('createBudget.body')

  return (
    <WizardScreen step="budget" avoidKeyboard>
      <View ref={viewportRef} testID="create-budget-viewport" collapsable={false} style={styles.scroll} onLayout={schedule}>
        <ScrollView ref={scrollRef}
          onLayout={schedule} onContentSizeChange={schedule}
          onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag} scrollEventThrottle={16}
          testID="create-budget-scroll"
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          <Text variant="discoveryTitle">{roomType === 'group' ? t('groupSetup.budgetBy') : t('createBudget.title')}</Text>
          <Text color="text.secondary" style={styles.body}>{subtitle}</Text>

          {offerUsual && usualTier ? (
            <View style={styles.prefillRow}>
              <Chip
                icon="dollar"
                label={t('createBudget.useUsualAction')}
                accessibilityLabel={t('createBudget.useUsual', { tier: `${t(`createBudget.range.${usualTier.key}`)} ${unit}` })}
                variant={selectedAmount === usualTier.amount ? 'selected' : 'info'}
                onPress={useUsualBudget}
              />
              <Text variant="bodySmall" style={styles.prefillAmount}>
                {t(`createBudget.range.${usualTier.key}`)} {unit}
              </Text>
            </View>
          ) : null}

          <Controller control={form.control} name="budgetAmount" render={({ field }) =>
            <BudgetPicker visibilityField={visibilityField} submitAttempt={form.formState.submitCount} value={field.value} onBlur={field.onBlur} roomType={roomType} budgetMode={budgetMode}
              onChange={amount => {
                field.onChange(amount)
                patchDraft({ budgetAmount: budgetPickerSchema.safeParse({ budgetAmount: amount }).success ? amount : null })
              }} />
          } />
        </ScrollView>
      </View>
      <GlassBar placement="docked" testID="create-footer">
        <PrimaryBtn variant="stitch" label={t('common.continue')} disabled={!valid} onPress={() => void form.handleSubmit(next)()} icon="arrowRight" />
      </GlassBar>
    </WizardScreen>
  )
}
