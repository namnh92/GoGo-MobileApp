import { overlay } from './tokens'
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  name: { flex: 1, minWidth: 0, gap: 2 },
  badge: { flexShrink: 0, paddingHorizontal: 10, paddingVertical: 2 },
  meta: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  text: { marginTop: 8 },
  photos: { marginTop: 10, flexDirection: 'row', gap: 8 },
  photo: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
  overflow: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: overlay.scrimText, alignItems: 'center', justifyContent: 'center' },
}))
