import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const FIELD_HEIGHT = 48
const BORDER_WIDTH = 1
// Same shell tokens as the create wizard's room-name field.
export const styles = StyleSheet.create(theme => ({
  shell: {
    minHeight: FIELD_HEIGHT,
    borderRadius: radius.compact,
    borderWidth: BORDER_WIDTH,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.subtle,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    ...type.body,
    lineHeight: undefined,
    flex: 1,
    minWidth: 0,
    height: FIELD_HEIGHT - 2 * BORDER_WIDTH,
    padding: spacing[3],
    color: theme.text.primary,
  },
  // Leave room for the small buttons' hitSlop within their native parent.
  trailing: { minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', paddingRight: spacing[1] },
}))
