import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, FlatList, Platform, View } from 'react-native'

import {
  useAssistantMessages,
  type AssistantMessage,
  type AssistantReplyConnection,
} from '@/shared/api'
import type { OutgoingMessage } from '@/shared/store/assistantDraftStore'
import { Text } from '@/shared/ui/text'

import { plainAnswer } from './answer-text'
import { AssistantReply, type ReplyActions } from './assistant-reply.view'
import { formatClock } from './format'
import { sendErrorCopy } from './send-error'
import { StateNotice } from './state-notice.view'
import { UserMessage } from './user-message.view'
import { styles } from './conversation.style'

type Row = { key: string; outgoing: OutgoingMessage } | { key: string; message: AssistantMessage }

/**
 * Design `ScreenConversation` (GoGo-MobileApp#378): a bottom-anchored
 * (inverted) thread, so the newest message stays just above the composer as
 * the keyboard opens; scrolling up loads older pages. Messages the server has
 * not accepted are drafts from the store, drawn below the server's.
 *
 * A finished reply is announced politely ("GoGo AI replied: …"); a failure is
 * announced as an alert by its `StateNotice`.
 */
export function Conversation({
  conversationId,
  outgoing,
  onRetry,
  step,
  connection,
  onRetryStream,
  actions,
  sendDisabled,
  footer,
}: {
  conversationId: string | null
  outgoing: OutgoingMessage[]
  onRetry: (localId: string) => void
  step: string | null
  connection: AssistantReplyConnection | null
  onRetryStream: () => void
  actions: ReplyActions
  sendDisabled: boolean
  /** Drawn under the newest message: the limit / unavailable notice. */
  footer?: React.ReactNode
}) {
  const { t, i18n } = useTranslation()
  const query = useAssistantMessages(conversationId)
  const messages = useMemo(() => query.data?.pages.flatMap(page => page.items) ?? [], [query.data])

  const rows: Row[] = useMemo(
    () => [
      ...outgoing.map(item => ({ key: item.localId, outgoing: item })),
      ...messages.map(message => ({ key: message.id, message })),
    ],
    [outgoing, messages],
  )

  const placeNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const message of messages) {
      for (const card of message.cards ?? []) if (card.kind === 'place') names.set(card.placeId, card.facts.name)
    }
    return names
  }, [messages])

  const latestReplyId = outgoing.length === 0 && messages[0]?.role === 'assistant' ? messages[0].id : null

  // Announce a reply once it is finished.
  const announced = useRef<{ id: string | null; status: string | null }>({ id: null, status: null })
  const newest = messages[0]?.role === 'assistant' ? messages[0] : null
  useEffect(() => {
    if (!newest) return
    const before = announced.current
    announced.current = { id: newest.id, status: newest.status }
    if (before.id !== newest.id || before.status !== 'streaming') return
    if (newest.status === 'streaming' || newest.status === 'failed') return
    const text = plainAnswer(newest.text).slice(0, 280)
    if (!text) return
    const line = t('assistant.message.replied', { text })
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(line, { queue: true })
    else AccessibilityInfo.announceForAccessibility(line)
  }, [newest, t])

  if (conversationId && query.isPending && outgoing.length === 0) {
    return (
      <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={t('assistant.loading')}>
        <ActivityIndicator />
        <Text variant="bodySmall" color="text.secondary">{t('assistant.loading')}</Text>
      </View>
    )
  }
  if (conversationId && query.isError && messages.length === 0) {
    return (
      <View style={styles.center}>
        <StateNotice
          kind="error"
          inline={false}
          title={t('assistant.error.load.title')}
          body={t('assistant.error.load.body')}
          actions={[{ label: t('assistant.retry'), onPress: () => void query.refetch() }]}
        />
      </View>
    )
  }

  const questionBefore = (index: number): string | null => {
    for (let at = index + 1; at < rows.length; at += 1) {
      const row = rows[at]!
      if ('message' in row && row.message.role === 'user') return row.message.text
    }
    return null
  }

  return (
    <FlatList
      testID="assistant-thread"
      inverted
      data={rows}
      keyExtractor={row => row.key}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={styles.thread}
      ListHeaderComponent={footer ? <View style={styles.footer}>{footer}</View> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={styles.older} /> : null}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
      }}
      onEndReachedThreshold={0.4}
      renderItem={({ item, index }) => {
        if ('outgoing' in item) {
          const failed = item.outgoing.status === 'failed'
          const copy = failed ? sendErrorCopy(item.outgoing.error, t) : null
          return (
            <View style={styles.turn}>
              <UserMessage
                text={item.outgoing.text}
                photos={item.outgoing.images.length}
                state={failed ? 'failed' : 'sending'}
                onRetry={copy?.retry && !sendDisabled ? () => onRetry(item.outgoing.localId) : undefined}
              />
              {copy ? (
                <StateNotice
                  kind="error"
                  title={copy.title}
                  body={copy.body}
                  actions={copy.retry ? [{ label: t('assistant.retry'), onPress: () => onRetry(item.outgoing.localId), disabled: sendDisabled }] : []}
                />
              ) : null}
            </View>
          )
        }
        const { message } = item
        if (message.role === 'user') {
          return (
            <View style={styles.turn}>
              <UserMessage text={message.text} time={formatClock(message.createdAt)} photos={message.attachments?.length ?? 0} />
            </View>
          )
        }
        return (
          <View style={styles.turn}>
            <AssistantReply
              message={message}
              latest={message.id === latestReplyId}
              previousQuestion={questionBefore(index)}
              step={message.status === 'streaming' ? step : null}
              connection={message.status === 'streaming' ? connection : null}
              onRetryStream={onRetryStream}
              rowContext={{ locale: i18n.language, placeNames }}
              actions={actions}
              sendDisabled={sendDisabled}
            />
          </View>
        )
      }}
    />
  )
}
