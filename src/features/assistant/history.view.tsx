import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { LoadingIndicator } from '@/shared/ui/loading-indicator.view'
import { PullToRefresh } from '@/shared/ui/refresh-control.view'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, SectionList, View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'

import {
  useAssistantConversations,
  useDeleteAssistantConversation,
  useRenameAssistantConversation,
  type AssistantConversation,
} from '@/shared/api'
import { GhostBtn, PrimaryBtn } from '@/shared/ui/button.view'
import { useDialog } from '@/shared/ui/dialog.view'
import { Icon } from '@/shared/ui/icons'
import { SearchField } from '@/shared/ui/search-field.view'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { useToast } from '@/shared/ui/toast.view'

import { AssistantHeader } from './assistant-header.view'
import { plainAnswer } from './answer-text'
import { formatClock, formatShortDate } from './format'
import { groupConversations, type HistoryGroupKey } from './history-groups'
import { HistoryItem } from './history-item.view'
import { StateNotice } from './state-notice.view'
import { styles } from './history.style'

/** Typing settles this long before the search goes out. */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * Design `ScreenHistory` (GoGo-MobileApp#378): the account's conversations,
 * stored on the server for 90 days. Search matches titles and message text
 * (contract `q`, 2+ characters) and marks the match; groups are Today /
 * Yesterday / Earlier in the device's time zone; ⋯ or a long press opens
 * Rename (a sheet, name preselected) and Delete (a dialog naming what goes).
 */
export function History({
  activeId,
  onBack,
  onOpen,
  onNewChat,
}: {
  activeId: string | null
  onBack: () => void
  onOpen: (conversation: AssistantConversation) => void
  onNewChat: () => void
}) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { confirm, dialog } = useDialog()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])
  const searching = query.length >= 2
  const list = useAssistantConversations(searching ? query : '')
  const rename = useRenameAssistantConversation()
  const remove = useDeleteAssistantConversation()
  const [menuFor, setMenuFor] = useState<AssistantConversation | null>(null)
  /**
   * What the menu's choice opens once the menu sheet has gone (acceptance
   * BUG3): the rename sheet or the delete dialog is another RN `Modal`, and
   * iOS refuses one asked for while the menu is still up — nothing shows and
   * every later tap is swallowed. So a row press only records the choice and
   * closes the menu; the menu's `onClosed` opens the next one.
   */
  const afterMenu = useRef<(() => void) | null>(null)
  const chooseFromMenu = (next: () => void) => {
    afterMenu.current = next
    setMenuFor(null)
  }
  const menuClosed = () => {
    const next = afterMenu.current
    afterMenu.current = null
    next?.()
  }
  const [renaming, setRenaming] = useState<AssistantConversation | null>(null)
  const [name, setName] = useState('')

  const items = useMemo(() => list.data?.pages.flatMap(page => page.items) ?? [], [list.data])
  const sections = useMemo(() => groupConversations(items, new Date()).map(group => ({ key: group.key, data: group.items })), [items])
  const titleOf = (conversation: AssistantConversation) => conversation.title ?? t('assistant.newChat')
  const groupTitle = (key: HistoryGroupKey) =>
    key === 'today' ? t('assistant.history.today') : key === 'yesterday' ? t('assistant.history.yesterday') : t('assistant.history.earlier')

  const askDelete = async (conversation: AssistantConversation) => {
    const answer = await confirm({
      title: t('assistant.history.deleteTitle'),
      message: t('assistant.history.deleteBody', { title: titleOf(conversation) }),
      actions: [
        { key: 'delete', label: t('assistant.history.delete'), style: 'destructive' },
        { key: 'cancel', label: t('common.cancel'), style: 'cancel' },
      ],
    })
    if (answer !== 'delete') return
    remove.mutate(conversation.id, {
      onSuccess: () => toast.show(t('assistant.history.deleted')),
      onError: () => toast.show(t('assistant.history.deleteFailed')),
    })
  }

  const saveName = () => {
    if (!renaming) return
    const next = name.trim()
    rename.mutate(
      { id: renaming.id, title: next },
      {
        onSuccess: () => {
          setRenaming(null)
          toast.show(t('assistant.history.renamed'))
        },
        onError: () => toast.show(t('assistant.history.renameFailed')),
      },
    )
  }

  const newChat = (
    <Pressable
      testID="assistant-history-new-chat"
      accessibilityRole="button"
      accessibilityLabel={t('assistant.newChat')}
      onPress={onNewChat}
      style={styles.newChat}
    >
      <View style={styles.newChatTile}>
        <Icon name="sparkle" size={22} color="accent.onAccent" />
      </View>
      <View style={styles.newChatLabel}>
        <Text variant="title2" numberOfLines={1}>{t('assistant.newChat')}</Text>
        <Text variant="bodySmall" color="text.secondary" numberOfLines={1}>{t('assistant.welcome.body')}</Text>
      </View>
      <View style={styles.newChatPlus}>
        <Icon name="plus" size={20} color="text.primary" />
      </View>
    </Pressable>
  )

  let body: React.ReactNode
  if (list.isPending) {
    body = (
      <View testID="assistant-history-loading" style={styles.loading} accessible accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
        {[0, 1, 2].map(key => <View key={key} style={styles.loadingRow}>
          <Skeleton width={44} height={44} />
          <View style={styles.newChatLabel}><Skeleton width="85%" height={20} /><Skeleton width="65%" height={16} /></View>
        </View>)}
      </View>
    )
  } else if (list.isError && items.length === 0) {
    body = (
      <StateNotice
        kind="error"
        inline={false}
        title={t('assistant.history.error.title')}
        body={t('assistant.history.error.body')}
        actions={[{ label: t('assistant.retry'), onPress: () => void list.refetch() }]}
      />
    )
  } else if (items.length === 0) {
    body = searching ? (
      <StateNotice kind="empty" inline={false} icon="search" title={t('assistant.history.noMatch.title')} body={t('assistant.history.noMatch.body')} />
    ) : (
      <StateNotice kind="empty" inline={false} icon="history" title={t('assistant.history.empty.title')} body={t('assistant.history.empty.body')} />
    )
  } else {
    body = (
      <PullToRefresh onRefresh={() => list.refetch()}><SectionList
        testID="assistant-history-list"
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
        }}
        ListHeaderComponent={
          searching ? (
            <Text variant="caption" color="text.secondary" accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.count}>
              {t('assistant.history.count', { count: items.length })}
            </Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.groupRow}>
            <Text variant="label" color="text.secondary" accessibilityRole="header" style={styles.group}>
              {groupTitle(section.key)}
            </Text>
            <Text variant="caption" color="text.secondary">{t('assistant.history.count', { count: section.data.length })}</Text>
          </View>
        )}
        ListFooterComponent={
          <>
          {list.isFetchingNextPage ? <LoadingIndicator /> : null}
          {list.isFetchNextPageError ? <StateNotice kind="error" title={t('assistant.history.error.title')}
            body={t('assistant.history.error.body')} actions={[{ label: t('assistant.retry'), onPress: () => void list.fetchNextPage() }]} /> : null}
          <View style={styles.retention}>
            <View style={styles.retentionIcon}>
              <Icon name="lock" size={18} color="text.secondary" />
            </View>
            <Text variant="bodySmall" color="text.secondary" style={styles.retentionText}>{t('assistant.history.empty.body')}</Text>
          </View>
          </>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, section }) => (
          <HistoryItem
            title={titleOf(item)}
            // Previews are raw answer text: `**bold**` and `[1]` would be drawn
            // and read aloud as typed.
            preview={previewText(item.match?.snippet ?? item.preview)}
            time={section.key === 'earlier' ? formatShortDate(item.lastMessageAt, i18n.language) : formatClock(item.lastMessageAt)}
            active={item.id === activeId}
            query={searching ? query : ''}
            onOpen={() => onOpen(item)}
            onMenu={() => setMenuFor(item)}
          />
        )}
      /></PullToRefresh>
    )
  }

  return (
    <View testID="assistant-history-screen" style={styles.screen}>
      <AssistantHeader onBack={onBack} title={t('assistant.history.title')} avatar={false} />
      <View style={styles.newChatWrap}>{newChat}</View>
      <View style={styles.search}>
        <SearchField
          accessibilityLabel={t('assistant.history.search')}
          placeholder={t('assistant.history.search')}
          value={text}
          onChangeText={setText}
        />
      </View>
      {items.length === 0 && !list.isPending ? <PullToRefresh onRefresh={() => list.refetch()}><ScrollView>{body}</ScrollView></PullToRefresh> : body}

      <Sheet
        visible={menuFor !== null}
        onClose={() => {
          afterMenu.current = null
          setMenuFor(null)
        }}
        onClosed={menuClosed}
        testID="assistant-history-menu"
      >
        {menuFor ? (
          <View style={styles.menu}>
            <Text variant="title2" numberOfLines={1}>{titleOf(menuFor)}</Text>
            <MenuRow
              icon="newChat"
              label={t('assistant.history.rename')}
              onPress={() => {
                const target = menuFor
                chooseFromMenu(() => {
                  setName(titleOf(target))
                  setRenaming(target)
                })
              }}
            />
            <MenuRow
              icon="trash"
              danger
              label={t('assistant.history.delete')}
              onPress={() => {
                const target = menuFor
                chooseFromMenu(() => void askDelete(target))
              }}
            />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={renaming !== null} onClose={() => setRenaming(null)} testID="assistant-rename-sheet">
        {renaming ? (
          <RenameForm
            value={name}
            onChange={setName}
            canSave={name.trim().length > 0 && name.trim() !== titleOf(renaming)}
            saving={rename.isPending}
            onSave={saveName}
            onCancel={() => setRenaming(null)}
          />
        ) : null}
      </Sheet>
      {dialog}
    </View>
  )
}

function previewText(text: string | null | undefined): string | undefined {
  if (!text) return undefined
  return plainAnswer(text.replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')) || undefined
}

function MenuRow({ icon, label, onPress, danger = false }: { icon: 'newChat' | 'trash'; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.menuRow}
    >
      <Icon name={icon} size={20} color={danger ? 'status.dangerText' : 'text.primary'} />
      <Text variant="body" color={danger ? 'status.dangerText' : 'text.primary'}>{label}</Text>
    </Pressable>
  )
}

function RenameForm({
  value,
  onChange,
  canSave,
  saving,
  onSave,
  onCancel,
}: {
  value: string
  onChange: (text: string) => void
  canSave: boolean
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  return (
    <View style={styles.menu}>
      <BlockingLoadingOverlay visible={saving} />
      <Text variant="title2" accessibilityRole="header">{t('assistant.history.renameTitle')}</Text>
      <View style={styles.field}>
        <Text variant="caption" color="text.secondary">{t('assistant.history.renameField')}</Text>
        <TextInput
          testID="assistant-rename-input"
          accessibilityLabel={t('assistant.history.renameField')}
          value={value}
          onChangeText={onChange}
          autoFocus
          selectTextOnFocus
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={() => canSave && onSave()}
          placeholderTextColor={theme.text.secondary}
          style={styles.input}
        />
      </View>
      <SheetActions>
        <GhostBtn label={t('common.cancel')} onPress={onCancel} />
        <PrimaryBtn label={t('assistant.edit.save')} onPress={onSave} disabled={!canSave || saving} loading={saving} />
      </SheetActions>
    </View>
  )
}
