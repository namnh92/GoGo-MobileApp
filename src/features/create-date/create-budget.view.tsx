import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useMe } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Chip, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { IconCheck } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import { BUDGET_TIERS, DEFAULT_BUDGET_TIER, tierForAmount, type BudgetTier } from './budget-tiers'
import { WizardScreen } from './wizard-step.view'
import { styles } from './create-budget.style'

export default function CreateBudgetScreen() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const { roomType, budgetMode } = useRoom()
  const unit = t(roomType === 'couple' ? 'createBudget.unit.couple' : budgetMode === 'per_person' ? 'price.unit.per_person' : 'price.unit.per_group')
  const patchDraft = useRoomStore(state => state.patchDraft)
  const draftBudgetAmount = useRoomStore(state => state.budgetAmount)
  const { status } = useSession()
  const [selected, setSelected] = useState<BudgetTier>(() => draftBudgetAmount == null ? DEFAULT_BUDGET_TIER : tierForAmount(draftBudgetAmount) ?? DEFAULT_BUDGET_TIER)

  // ADR-0022: the profile's usual budget is per person, so it is offered only
  // when this room counts per person, only while the draft holds no amount,
  // and only by a tap — the tiers are the wizard's; the amount is mapped.
  const me = useMe({ enabled: status === 'user' })
  const usual = me.data?.usualBudget ?? null
  const usualTier = usual ? tierForAmount(usual.perPerson) : null
  const offerUsual = usualTier !== null && budgetMode === 'per_person' && draftBudgetAmount === null

  function useUsualBudget() {
    if (!usualTier) return
    setSelected(usualTier)
    patchDraft({ budgetAmount: usualTier.amount })
    track('profile_prefill_used', { field: 'usualBudget' })
  }

  function next() {
    // The amount is what the API constrains on; the tier key is presentation.
    patchDraft({ budgetAmount: selected.amount })
    router.push('/create/mood')
  }

  // #333: at 375pt the last tier ran under the bar; the step scrolls now.
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)

  // Group budget carries its scope explicitly — no couple copy on group flows.
  const subtitle =
    roomType === 'group'
      ? t(budgetMode === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal')
      : t('createBudget.body')

  return (
    <WizardScreen step="budget">
      <ScrollView
        testID="create-budget-scroll"
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: footerInset + spacing[4] }]}
      >
        <Text variant="discoveryTitle">{roomType === 'group' ? t('groupSetup.budgetBy') : t('createBudget.title')}</Text>
        <Text color="text.secondary" style={styles.body}>{subtitle}</Text>

        {offerUsual && usualTier ? (
          <View style={styles.prefillRow}>
            <Chip
              icon="dollar"
              label={t('createBudget.useUsualAction')}
              accessibilityLabel={t('createBudget.useUsual', { tier: `${t(`createBudget.range.${usualTier.key}`)} ${unit}` })}
              variant={selected.key === usualTier.key ? 'selected' : 'info'}
              onPress={useUsualBudget}
            />
            <Text variant="bodySmall" style={styles.prefillAmount}>
              {t(`createBudget.range.${usualTier.key}`)} {unit}
            </Text>
          </View>
        ) : null}

        <View style={styles.options}>
          {BUDGET_TIERS.map(tier => {
            const active = selected.key === tier.key
            return (
              <Pressable
                key={tier.key}
                onPress={() => { setSelected(tier); patchDraft({ budgetAmount: tier.amount }) }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? styles.optionActive : glassStyles.card]}
              >
                <View style={styles.optionBody}>
                  <Text variant="discoveryHeading" color={active ? 'accent.onSoft' : 'text.primary'}>
                    {t(`createBudget.range.${tier.key}`)}{tier.key !== 'flexible' ? ` ${unit}` : ''}
                  </Text>
                  <Text variant="bodySmall" color="text.secondary" style={styles.optionSub}>
                    {t(`createBudget.range.${tier.key}.sub`)}
                  </Text>
                </View>
                {/* Selection is a tint, a ring and a check, never colour alone. */}
                <View style={[styles.checkBubble, active && styles.checkBubbleActive]}>
                  {active ? <IconCheck color={theme.accent.onAccent} size={12} /> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
      <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
        <PrimaryBtn variant="stitch" label={t('common.continue')} onPress={next} icon="arrowRight" />
      </GlassBar>
    </WizardScreen>
  )
}
