import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { fold } from './highlight'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { styles } from './history-item.style'

/**
 * Design system `HistoryItem`: title, one line of the last message (or, in a
 * search, the matching line with the match marked), the time. The ⋯ button
 * and a long press open the same Rename / Delete menu, so nothing depends on
 * a hidden gesture.
 */
export function HistoryItem({
  title,
  preview,
  time,
  active,
  query,
  onOpen,
  onMenu,
}: {
  title: string
  preview?: string
  time: string
  active: boolean
  query: string
  onOpen: () => void
  onMenu: () => void
}) {
  const { t } = useTranslation()
  return (
    <View style={[styles.row, active && styles.rowActive]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, preview, time, active ? t('assistant.history.current') : null].filter(Boolean).join(', ')}
        onPress={onOpen}
        onLongPress={onMenu}
        style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
      >
        <View style={styles.text}>
          <Text variant="label" numberOfLines={1}>
            <Highlighted text={title} query={query} />
          </Text>
          {preview ? (
            <Text variant="bodySmall" color="text.secondary" numberOfLines={1}>
              <Highlighted text={preview} query={query} />
            </Text>
          ) : null}
        </View>
        <Text variant="caption" color="text.secondary">{time}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('assistant.history.menu', { title })}
        onPress={onMenu}
        style={({ pressed }) => [styles.menu, pressed && styles.menuPressed]}
      >
        <Icon name="more" size={20} color="text.secondary" />
      </Pressable>
    </View>
  )
}

/** Marks every accent- and case-insensitive occurrence of `query` in `text`. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = fold(query.trim())
  if (needle.length < 2) return <>{text}</>
  const folded = [...text].map(fold).join('')
  // Folding is per character here, so indexes in `folded` are indexes in `text`.
  if (folded.length !== text.length) return <>{text}</>
  const parts: { text: string; hit: boolean }[] = []
  let at = 0
  for (let found = folded.indexOf(needle); found !== -1; found = folded.indexOf(needle, at)) {
    if (found > at) parts.push({ text: text.slice(at, found), hit: false })
    parts.push({ text: text.slice(found, found + needle.length), hit: true })
    at = found + needle.length
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false })
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <Text key={index} variant="label" color="accent.onSoft" style={styles.hit}>{part.text}</Text>
        ) : (
          part.text
        ),
      )}
    </>
  )
}
