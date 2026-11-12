import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  avatarImage: { position: 'absolute', top: 0, left: 0 },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hostRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.accent.primary,
  },
  hostBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
