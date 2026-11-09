import { StyleSheet } from 'react-native-unistyles'
import { overlay } from './tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: 12 },
  photo: { height: 176, width: '100%', borderRadius: 16, overflow: 'hidden' },
  // A wrapping row keeps the Stitch top-left status and top-right date apart
  // on narrow cards / large text. The date owns the right edge on either row.
  photoHeader: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6 },
  badge: { maxWidth: '100%' },
  date: { marginLeft: 'auto', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: overlay.scrimText },
  body: { paddingTop: 12, paddingHorizontal: 4 },
  details: { paddingHorizontal: 4 },
  address: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border.hairline, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  supplement: { minHeight: 44, justifyContent: 'center' },
}))
