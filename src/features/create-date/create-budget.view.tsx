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
import { tierForAmount } from './budget-tiers'
import { RoomBudgetField } from '@/shared/ui/room-budget-field.view'
import { GroupBudgetFields } from '@/shared/ui/group-budget-fields.view'
import { WizardStepHeader } from './wizard-step-header.view'
import { budgetPickerSchema } from './budget-picker'
import { firstInvalidRequiredStep, wizardParticipantCountSchema, WIZARD_MAX_PARTICIPANTS } from './required-steps'
import { WizardScreen } from './wizard-step.view'
import { styles } from './create-budget.style'

export default function CreateBudgetScreen() {
  const { t } = useTranslation()
  const { viewportRef, scrollRef, schedule, onScroll, onScrollBeginDrag } = useFieldVisibility('create-budget')
  const router = useRouter()
  const { roomType, budgetMode, setBudgetMode, setParticipantCount } = useRoom()
  const unit = roomType === 'couple' ? t('createBudget.unit.couple') : budgetUnitLabel(budgetMode, roomType, t)
  const patchDraft = useRoomStore(state => state.patchDraft)
  const participantCount = useRoomStore(state => state.participantCount)
  const draftBudgetAmount = useRoomStore(state => state.budgetAmount)
  const { status } = useSession()
  const selectedAmount = draftBudgetAmount
  const valid = budgetPickerSchema.safeParse({ budgetAmount: selectedAmount }).success
    && (roomType !== 'group' || wizardParticipantCountSchema.safeParse(participantCount).success)

  // ADR-0022: the profile's usual budget is per person, so it is offered only
  // when this room counts per person, only while the draft holds no amount,
  // and only by a tap — the tiers are the wizard's; the amount is mapped.
  const me = useMe({ enabled: status === 'user' })
  const usual = me.data?.usualBudget ?? null
  const usualTier = usual ? tierForAmount(usual.perPerson) : null
  const offerUsual = usualTier !== null && budgetMode === 'per_person' && draftBudgetAmount === null

  function useUsualBudget() {
    if (!usualTier) return
    patchDraft({ budgetAmount: usualTier.amount })
    track('profile_prefill_used', { field: 'usualBudget' })
  }

  function next() {
    // The amount is what the API constrains on; the tier key is presentation.
    if (!valid) return
    const invalid = firstInvalidRequiredStep(useRoomStore.getState())
    if (invalid === 'budget') return
    router.push(invalid ? `/create/${invalid}` : '/create/places')
  }

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
          <WizardStepHeader title={t(roomType === 'group' ? 'createBudget.title_group' : 'createBudget.title')}
            subtitle={t(roomType === 'group' ? 'createBudget.body_group' : 'createBudget.body')} />
          {roomType === 'group' ? <GroupBudgetFields count={participantCount} mode={budgetMode} maxCount={WIZARD_MAX_PARTICIPANTS}
            onCountChange={setParticipantCount} onModeChange={setBudgetMode} /> : null}
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

          <RoomBudgetField participantCount={participantCount} testID="create-budget-card" amount={selectedAmount} mode={budgetMode} roomType={roomType} showLabel={roomType === 'group'}
            onChange={amount => patchDraft({ budgetAmount: amount })} />
        </ScrollView>
      </View>
      <GlassBar placement="docked" testID="create-footer">
        <PrimaryBtn variant="stitch" label={t('common.continue')} disabled={!valid} onPress={next} icon="arrowRight" />
      </GlassBar>
    </WizardScreen>
  )
}
