import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import {
  isApiError,
  useConfirmAssistantProposal,
  useDismissAssistantProposal,
  type AssistantMessage,
  type AssistantFollowUpSelection,
  type AssistantNotice,
  type AssistantProposal,
  type AssistantReplyConnection,
} from '@/shared/api'
import { Text } from '@/shared/ui/text'

import { AnswerBlocks } from './answer-blocks.view'
import { AssistantMessage as AssistantTurn } from './assistant-message.view'
import { ConfirmationCard } from './confirmation-card.view'
import { FollowUps } from './follow-ups.view'
import { formatClock } from './format'
import type { RowContext } from './proposal-rows'
import { ResultCard } from './result-card.view'
import { SourceList } from './source-list.view'
import { StateNotice } from './state-notice.view'
import { TaskSummary } from './task-summary.view'
import { TypingIndicator } from './typing-indicator.view'
import { styles } from './assistant-reply.style'

/** Cards shown before "Show n more" (design `ResultCard`: at most 3 per message). */
export const VISIBLE_CARDS = 3

export interface ReplyActions {
  onSend: (text: string, followUp?: AssistantFollowUpSelection) => void
  onOpenPlace: (placeId: string) => void
  onOpenPlan: (planId: string, roomId: string) => void
  onOpenRoom: (roomId: string) => void
}

/**
 * One assistant turn, in the design's order: the live step, the answer
 * (lead → list), cards (results, confirmation, task summary), a state notice,
 * sources, and — under the latest reply only — follow-ups. A reply cut short
 * by the server's ceiling (`truncated`) says so, with Retry on the latest.
 */
export function AssistantReply({
  message,
  latest,
  previousQuestion,
  step,
  connection,
  onRetryStream,
  rowContext,
  actions,
  sendDisabled,
}: {
  message: AssistantMessage
  latest: boolean
  /** The question this reply answers, for "Ask again". */
  previousQuestion: string | null
  step: string | null
  connection: AssistantReplyConnection | null
  onRetryStream: () => void
  rowContext: Omit<RowContext, 't'>
  actions: ReplyActions
  sendDisabled: boolean
}) {
  const { t } = useTranslation()
  const [allCards, setAllCards] = useState(false)
  const streaming = message.status === 'streaming'
  const cards = message.cards ?? []
  const shownCards = allCards ? cards : cards.slice(0, VISIBLE_CARDS)
  const hiddenCards = cards.length - shownCards.length
  const groups = message.followUps ?? []
  // The contract uses `field` as the stable group kind (no separate `kind`).
  const placeFollowUpLabels = new Map([
    ['place_choice', t('assistant.followUps.placeChoice')],
    ['place_confirm', t('assistant.followUps.placeConfirm')],
    ['place_topic', t('assistant.followUps.placeTopic')],
  ])
  const fallback = message.notice?.kind === 'fallback'

  const fixedFollowUps =
    fallback && groups.length === 0
      ? [
          ...(previousQuestion ? [{ label: t('assistant.notice.fallback.askAgain'), text: previousQuestion }] : []),
          { label: t('assistant.notice.fallback.whatCan'), text: t('assistant.notice.fallback.whatCan') },
        ]
      : []

  return (
    <AssistantTurn time={streaming ? undefined : formatClock(message.completedAt ?? message.createdAt)} testID={`assistant-reply-${message.id}`}>
      {streaming ? <TypingIndicator label={typingLabel(connection === 'reconnecting' ? 'reconnecting' : step, t)} /> : null}
      {message.text ? <AnswerBlocks text={message.text} /> : null}
      {shownCards.map((card, index) => (
        <ResultCard key={`${card.kind}-${index}`} card={card} onOpenPlace={actions.onOpenPlace} onOpenPlan={actions.onOpenPlan} />
      ))}
      {hiddenCards > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('assistant.message.showMore', { count: hiddenCards })}
          onPress={() => setAllCards(true)}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
        >
          <Text variant="label" color="accent.primary">{t('assistant.message.showMore', { count: hiddenCards })}</Text>
        </Pressable>
      ) : null}
      {(message.proposals ?? []).map(proposal => (
        <ProposalBlock key={proposal.id} proposal={proposal} conversationId={message.conversationId} rowContext={rowContext} actions={actions} />
      ))}
      {message.notice ? <NoticeBlock notice={message.notice} /> : null}
      {message.sources && message.sources.length > 0 ? <SourceList sources={message.sources} /> : null}
      {message.status === 'stopped' ? (
        <Text variant="caption" color="text.secondary">{t('assistant.message.stopped')}</Text>
      ) : null}
      {message.status === 'failed' ? (
        <StateNotice
          kind="error"
          title={message.error?.code === 'ASSISTANT_DISABLED' ? t('assistant.notice.disabled.title') : t('assistant.error.reply.title')}
          body={message.error?.code === 'ASSISTANT_DISABLED' ? t('assistant.notice.disabled.body') : t('assistant.error.reply.body')}
          actions={
            previousQuestion && latest && message.error?.code !== 'ASSISTANT_DISABLED'
              ? [{ label: t('assistant.notice.fallback.askAgain'), onPress: () => actions.onSend(previousQuestion), disabled: sendDisabled }]
              : []
          }
        />
      ) : null}
      {message.status === 'truncated' ? (
        // The server's hard ceiling (2.0.0-alpha.3): no automatic continuation,
        // only this explicit Retry — the same question as a new send. Read in
        // order and announced politely by the thread, never as an alert.
        <StateNotice
          kind="info"
          testID={`assistant-truncated-${message.id}`}
          title={t('assistant.message.truncated.title')}
          body={t('assistant.message.truncated.body')}
          actions={
            previousQuestion && latest
              ? [{ label: t('assistant.retry'), onPress: () => actions.onSend(previousQuestion), disabled: sendDisabled }]
              : []
          }
        />
      ) : null}
      {streaming && connection === 'lost' ? (
        <StateNotice
          kind="error"
          title={t('assistant.stream.lostTitle')}
          body={t('assistant.stream.lostBody')}
          actions={[{ label: t('assistant.retry'), onPress: onRetryStream }]}
        />
      ) : null}
      {latest && !streaming && groups.length > 0 ? (
        <View style={styles.followUps}>
          {groups.map(group => (
            <FollowUps
              key={group.field}
              label={placeFollowUpLabels.get(group.field) ?? group.label}
              items={group.options}
              onSelect={(text, optionId) => actions.onSend(text, optionId ? { replyToMessageId: message.id, followUpOptionId: optionId } : undefined)}
              disabled={sendDisabled}
            />
          ))}
          <Text variant="bodySmall" color="text.secondary">{t('assistant.followUps.typeInstead')}</Text>
        </View>
      ) : null}
      {latest && !streaming && fixedFollowUps.length > 0 ? (
        <FollowUps items={fixedFollowUps} onSelect={text => actions.onSend(text)} disabled={sendDisabled} />
      ) : null}
    </AssistantTurn>
  )
}

function typingLabel(step: string | null, t: ReturnType<typeof useTranslation>['t']): string {
  switch (step) {
    case 'reading_guide':
      return t('assistant.typing.reading_guide')
    case 'searching_places':
      return t('assistant.typing.searching_places')
    case 'reading_plan':
      return t('assistant.typing.reading_plan')
    case 'writing':
      return t('assistant.typing.writing')
    case 'reconnecting':
      return t('assistant.typing.reconnecting')
    default:
      return t('assistant.typing.thinking')
  }
}

/** Notice copy is the app's own (contract: `copyKey` names fixed copy, never model text). */
function NoticeBlock({ notice }: { notice: AssistantNotice }) {
  const { t } = useTranslation()
  switch (notice.kind) {
    case 'empty':
      return <StateNotice kind="empty" icon="search" title={t('assistant.notice.empty.title')} body={t('assistant.notice.empty.body')} />
    case 'fallback':
      return <StateNotice kind="info" icon="clock" title={t('assistant.notice.fallback.title')} body={t('assistant.notice.fallback.body')} />
    case 'limit':
      return <StateNotice kind="info" title={t('assistant.notice.limit.title')} />
    case 'disabled':
      return <StateNotice kind="info" title={t('assistant.notice.disabled.title')} body={t('assistant.notice.disabled.body')} />
    default:
      return <StateNotice kind="info" title={t('assistant.notice.generic.title')} />
  }
}

function ProposalBlock({
  proposal,
  conversationId,
  rowContext,
  actions,
}: {
  proposal: AssistantProposal
  conversationId: string
  rowContext: Omit<RowContext, 't'>
  actions: ReplyActions
}) {
  const confirm = useConfirmAssistantProposal(conversationId)
  const dismiss = useDismissAssistantProposal(conversationId)
  const error = confirm.error ?? dismiss.error
  return (
    <>
      <BlockingLoadingOverlay visible={confirm.isPending || dismiss.isPending} />
      <ConfirmationCard
        proposal={proposal}
        context={rowContext}
        confirming={confirm.isPending}
        dismissing={dismiss.isPending}
        error={isApiError(error) && error.status === 409 ? null : error}
        onConfirm={values => confirm.mutate({ proposalId: proposal.id, ...(values ? { values } : {}) })}
        onDismiss={() => dismiss.mutate(proposal.id)}
      />
      {proposal.status === 'confirmed' && proposal.result ? (
        <TaskSummary result={proposal.result} context={rowContext} onOpenRoom={actions.onOpenRoom} />
      ) : null}
    </>
  )
}
