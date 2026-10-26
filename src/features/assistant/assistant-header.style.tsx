import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/** Design system `AssistantHeader`, modal form: Close (×) first, then avatar and title. */
export const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  close: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { backgroundColor: theme.surface.subtle },
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], flex: 1, minWidth: 0 },
  text: { flexShrink: 1 },
}))
