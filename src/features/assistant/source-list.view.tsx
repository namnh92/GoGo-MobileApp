import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import type { AssistantSource } from '@/shared/api'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { formatShortDate } from './format'
import { styles } from './source-list.style'

/** At most three show; the rest collapse into "+n more". */
export const VISIBLE_SOURCES = 3

/**
 * Design system `SourceList`: the documents the answer used, numbered like
 * the `Cite` markers. Every word comes from the API — the published GoGo
 * guide, or GoGo place data with its "Last checked" date — never the model.
 * Not tappable: the contract gives the app no way to open a guide document.
 */
export function SourceList({ sources }: { sources: AssistantSource[] }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const sorted = [...sources].sort((a, b) => a.index - b.index)
  const shown = open ? sorted : sorted.slice(0, VISIBLE_SOURCES)
  const hidden = sorted.length - shown.length
  return (
    <View testID="assistant-sources" style={styles.list}>
      <Text variant="caption" color="text.secondary" accessibilityRole="header">{t('assistant.sources.title')}</Text>
      {shown.map(source => {
        const detail =
          source.kind === 'place_data' && source.checkedAt
            ? t('assistant.sources.placeData', { date: formatShortDate(source.checkedAt, i18n.language) })
            : source.description
        return (
          <View key={source.index} style={styles.row} accessible>
            <View style={styles.number}>
              <Text variant="caption" color="accent.onSoft">{source.index}</Text>
            </View>
            <View style={styles.text}>
              <Text variant="label" numberOfLines={2}>{source.title}</Text>
              {detail ? <Text variant="caption" color="text.secondary">{detail}</Text> : null}
            </View>
            <Icon name="doc" size={16} color="text.secondary" />
          </View>
        )
      })}
      {hidden > 0 || open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? t('assistant.sources.less') : t('assistant.sources.more', { count: hidden })}
          onPress={() => setOpen(value => !value)}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
        >
          <Text variant="label" color="accent.primary">
            {open ? t('assistant.sources.less') : t('assistant.sources.more', { count: hidden })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
