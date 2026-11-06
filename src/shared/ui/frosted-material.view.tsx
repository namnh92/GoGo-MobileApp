import { BlurView } from 'expo-blur'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './frosted-material.style'

/** S60/S56 material. Readable wash on every path; opaque under reduced transparency. */
export function FrostedMaterial({ kind = 'panel' }: { kind?: 'panel' | 'bubble' | 'header' }) {
  const { theme } = useUnistyles()
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then(value => { if (active) setReduced(value) }).catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced)
    return () => { active = false; subscription.remove() }
  }, [])
  return <View pointerEvents="none" style={styles.fill}>
    {!reduced && <BlurView tint={theme.glass.bar.tint} intensity={theme.glass.bar.intensity} experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={styles.nativeFill} />}
    <View style={[styles.fill, styles[kind], reduced && (kind === 'header' ? styles.solidHeader : styles.solid)]} />
  </View>
}
