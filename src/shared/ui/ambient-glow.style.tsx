import { StyleSheet } from 'react-native-unistyles'
import { fill } from './tokens'
export const styles = StyleSheet.create({
  fill: { ...fill, overflow: 'hidden' },
  orb: { position: 'absolute' },
  warm: { width: 448, height: 448, top: -128, left: -128 },
  cool: { width: 512, height: 512, bottom: -144, right: -144 },
  green: { width: 384, height: 384, top: '28%', left: '0%' },
  cardTop: { width: 240, height: 240, top: -96, right: -96 },
  cardBottom: { width: 224, height: 224, bottom: -80, left: -80 },
  swipeWarm: { width: 352, height: 352, top: -80, alignSelf: 'center' },
  swipeCool: { width: 272, height: 272, bottom: -56, alignSelf: 'center' },
})
