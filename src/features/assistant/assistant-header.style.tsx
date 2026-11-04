import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/** Design system `AssistantHeader`: 44pt icon buttons, avatar and title in between. */
export const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.border.hairline,
  },
  button: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: theme.surface.subtle },
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], flex: 1, minWidth: 0, paddingHorizontal: theme.spacing[1] },
  text: { flexShrink: 1 },
}))
