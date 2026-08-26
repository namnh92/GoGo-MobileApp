import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { colors } from '@/shared/ui/tokens'
import { styles } from './splash.style'

const SPLASH_MS = 2200

export default function SplashScreen() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/onboarding'), SPLASH_MS)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <View style={styles.root}>
      <View style={[styles.deco, { top: -80, left: -60 }]} />
      <View style={[styles.deco, { bottom: -100, right: -40, width: 380, height: 380, borderRadius: 190 }]} />
      <View style={styles.logoBox}>
        <Svg width={42} height={42} viewBox="0 0 42 42" fill="none">
          <Circle cx={14} cy={21} r={9} fill={colors.brand.coral} />
          <Circle cx={28} cy={21} r={9} fill={colors.brand.coral} opacity={0.6} />
          <Path d="M21 14 C17 14, 14 17, 14 21 C14 25, 17 28, 21 28 C25 28, 28 25, 28 21 C28 17, 25 14, 21 14Z" fill={colors.neutral[0]} />
        </Svg>
      </View>
      <Text style={styles.title}>GoGo</Text>
      <Text style={styles.tagline}>Có kèo, đi đâu.</Text>
    </View>
  )
}
