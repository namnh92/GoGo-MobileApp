import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { Card } from '@/shared/ui/card.view'
import { Chip, type ChipVariant } from '@/shared/ui/primitives'
import { Glyph, Text } from '@/shared/ui/text'

import { styles } from './plan-card.style'

/**
 * A plan in the Kế hoạch list (#293 §3). Strings in, no DTO: the screen
 * composes the facts (`2 người · Thành viên · 1/2 đã chọn xong · Thứ Bảy 27/9`)
 * and the status, and this only lays them out.
 *
 * The title is never truncated — "Kèo…" tells nobody which plan it is — so it
 * wraps, and the card grows. The meta line wraps too.
 *
 * The status chip sits under the facts, inside the text column (#298). Pinned
 * to the right of the column, a long status ("Đang chờ mọi người chọn") took
 * most of a 375pt row and squeezed the title and meta to one word per line;
 * under them it never takes width from either.
 *
 * `metaAccessibilityLabel` is the same facts as spoken sentences: "800k/người"
 * read aloud is noise, "Ngân sách 800k mỗi người" is the fact (GoGo-BE#637).
 */
export function PlanCard({ icon, title, meta, metaAccessibilityLabel, status, past = false, onPress, style, testID }: {
  /** Emoji for the room type. */
  icon: string
  title: string
  meta: string
  /** The meta facts as a screen reader should say them; defaults to `meta`. */
  metaAccessibilityLabel?: string
  status: { label: string; variant: ChipVariant }
  past?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={style}>
      <Card style={[styles.card, past && styles.past]}>
        <View style={[styles.icon, past && styles.iconPast]}>
          <Glyph size="sm">{icon}</Glyph>
        </View>
        <View style={styles.body}>
          <Text testID="plan-card-title" variant="title2">{title}</Text>
          <Text
            testID="plan-card-meta"
            variant="bodySmall"
            color="text.secondary"
            accessibilityLabel={metaAccessibilityLabel}
          >
            {meta}
          </Text>
          <Chip label={status.label} variant={status.variant} style={styles.status} />
        </View>
      </Card>
    </Pressable>
  )
}
