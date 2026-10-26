import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Text } from '@/shared/ui/text'

import { parseAnswer, type Inline } from './answer-text'
import { styles } from './answer-blocks.style'

/**
 * The answer text as the design draws it (GoGo-MobileApp#378): the lead
 * sentence as `body`, steps as a numbered `MessageList` (accent-soft discs),
 * facts as bullets, and `[n]` as a `Cite` marker
 * that matches the `SourceList` below.
 */
export function AnswerBlocks({ text }: { text: string }) {
  const blocks = parseAnswer(text)
  return (
    <View style={styles.blocks}>
      {blocks.map((block, index) =>
        block.kind === 'paragraph' ? (
          <Text key={index} variant="body">
            <Inlines inlines={block.inlines} />
          </Text>
        ) : (
          <View key={index} style={styles.list}>
            {block.items.map((item, at) => (
              <View key={at} style={styles.item}>
                {block.ordered ? (
                  <View style={styles.number} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Text variant="caption" color="accent.onSoft">{at + 1}</Text>
                  </View>
                ) : (
                  <View style={styles.bullet} />
                )}
                <Text variant="body" style={styles.itemText}>
                  <Inlines inlines={item} />
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  )
}

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, index) =>
        inline.kind === 'cite' ? (
          <Cite key={index} n={inline.n} />
        ) : (
          // Bold runs read as plain body: the type scale has no bold at body
          // size, and a 13pt label face inside a 15pt line jumps (#293 §4).
          inline.text
        ),
      )}
    </>
  )
}

/** Design system `Cite`: the source number after the claim it supports. */
export function Cite({ n }: { n: number }) {
  const { t } = useTranslation()
  return (
    <Text variant="caption" color="accent.onSoft" accessibilityLabel={t('assistant.cite', { n })} style={styles.cite}>
      {` ${n} `}
    </Text>
  )
}
