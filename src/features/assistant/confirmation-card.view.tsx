import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { isApiError, type AssistantProposal } from '@/shared/api'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/button.view'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { InfoRows } from './info-rows.view'
import { ProposalEditSheet } from './proposal-edit.view'
import {
  confirmLabel,
  doneLabel,
  effectiveValues,
  proposalTitle,
  type ProposalRow,
  type RowContext,
} from './proposal-rows'
import { styles } from './confirmation-card.style'
import { useProposalRows } from './use-proposal-rows'

/**
 * Design system `ConfirmationCard` (GoGo-MobileApp#378): the assistant
 * proposes, the person commits. Nothing is written until the button is
 * tapped — that tap is `confirmAssistantProposal`, the only assistant call
 * that writes GoGo data. Assumed values are flagged and can be changed here;
 * a change is sent as an edited value, which the server then counts as the
 * person's own. Who may do what stays the server's call: a refusal
 * (`HOST_ONLY`) is shown, never pre-empted by hiding the card.
 */
export function ConfirmationCard({
  proposal,
  context,
  confirming,
  dismissing,
  error,
  onConfirm,
  onDismiss,
}: {
  proposal: AssistantProposal
  context: Omit<RowContext, 't'>
  confirming: boolean
  dismissing: boolean
  error: unknown
  onConfirm: (values: Record<string, unknown> | undefined) => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [editing, setEditing] = useState<ProposalRow | null>(null)
  const values = effectiveValues(proposal.values, edits)
  const rows = useProposalRows(values, { ...context, t })
  const action = confirmLabel(proposal.kind, t)
  const pending = proposal.status === 'pending'
  const busy = confirming || dismissing

  const errorLine =
    error && pending
      ? isApiError(error) && error.code === 'HOST_ONLY'
        ? t('assistant.proposal.hostOnly')
        : t('assistant.proposal.failed')
      : null

  return (
    <View testID={`assistant-proposal-${proposal.id}`} style={styles.card}>
      <View style={styles.head}>
        <View style={styles.tile}>
          <Icon name="sparkle" size={18} color="accent.onAccent" />
        </View>
        <View style={styles.titles}>
          <Text variant="caption" color="accent.onSoft">{t('assistant.proposal.kicker')}</Text>
          <Text variant="title2" accessibilityRole="header">{proposalTitle(proposal, t)}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <InfoRows rows={rows} onEdit={pending ? setEditing : undefined} disabled={busy} />
        {pending ? (
          <>
            <Text variant="bodySmall" color="text.secondary">{t('assistant.proposal.note', { action })}</Text>
            {errorLine ? (
              <Text variant="bodySmall" color="status.dangerText" accessibilityRole="alert">{errorLine}</Text>
            ) : null}
            <View style={styles.actions}>
              <PrimaryBtn
                size="regular"
                variant="pill"
                label={confirming ? t('assistant.proposal.working') : action}
                loading={confirming}
                trailingIcon="check"
                disabled={busy}
                onPress={() => onConfirm(Object.keys(edits).length > 0 ? edits : undefined)}
              />
              <SecondaryBtn size="regular" variant="neutral" label={t('assistant.proposal.notNow')} loading={dismissing} disabled={busy} onPress={onDismiss} />
            </View>
          </>
        ) : (
          <View style={styles.outcome} accessibilityLiveRegion="polite">
            {proposal.status === 'confirmed' ? <Icon name="check" size={16} color="status.successText" /> : null}
            <Text
              variant="label"
              color={proposal.status === 'confirmed' ? 'status.successText' : 'text.secondary'}
              style={styles.outcomeText}
            >
              {proposal.status === 'confirmed'
                ? doneLabel(proposal.kind, t)
                : proposal.status === 'dismissed'
                  ? t('assistant.proposal.dismissed')
                  : t('assistant.proposal.expired')}
            </Text>
          </View>
        )}
      </View>
      <ProposalEditSheet
        row={editing}
        values={values}
        onClose={() => setEditing(null)}
        onSave={changes => {
          setEdits(current => ({ ...current, ...changes }))
          setEditing(null)
        }}
      />
    </View>
  )
}
