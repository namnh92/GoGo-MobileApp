import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  more: { minHeight: touchTarget.min, justifyContent: 'center', borderRadius: theme.radius.compact },
  morePressed: { backgroundColor: theme.surface.subtle },
  followUps: { gap: theme.spacing[3] },
}))
