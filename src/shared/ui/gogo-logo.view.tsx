import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import { useUnistyles } from 'react-native-unistyles'

import { BouncingRibbon, LogoBeam, TwinkleStar, WavingDot } from './gogo-logo-motion'
import { logoPaths } from './gogo-logo.asset'
import { brandLogo, fontFamily } from './tokens'

export type GoGoLogoProps = {
  variant?: 'mark' | 'wordmark' | 'compact'
  /** Width in points. Compact tab-root lockups use 32. */
  size?: number
  /** Optional viewport height; SVG keeps the asset's aspect ratio. */
  height?: number
  animated?: boolean
  testID?: string
}

/** One fixed brand asset; only the wordmark ink follows the surface theme. */
export function GoGoLogo({ variant = 'mark', size = 32, height, animated = false, testID = 'gogo-logo' }: GoGoLogoProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const compact = variant === 'compact'
  const wordmark = variant !== 'mark'
  const spectrum = `gogo-spectrum-${id}`
  const bridge = `gogo-bridge-${id}`
  const ribbon = <>
    <G transform={wordmark ? 'translate(0 -20)' : undefined}>
      <Path d={logoPaths.ribbon} stroke={`url(#${spectrum})`} strokeWidth={42} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={logoPaths.bridge} stroke={`url(#${bridge})`} strokeWidth={42} strokeLinecap="round" />
      {logoPaths.highlights.map((d, i) => <Path key={d} d={d} stroke={brandLogo.highlight} strokeWidth={7} strokeLinecap="round" opacity={i === 0 ? 0.42 : 0.45} />)}
    </G>
    {variant === 'wordmark' ? <LogoBeam animated={animated} testID={`${testID}-beam`} /> : null}
  </>
  return <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={t('splash.brand')}>
    <Svg testID={`${testID}-${variant}`} width={size} height={height ?? (compact ? size : wordmark ? size * 370 / 400 : size)} viewBox={compact ? '0 0 400 400' : wordmark ? '0 0 400 370' : '0 0 400 320'} fill="none" accessible={false}>
      <Defs>
        <LinearGradient id={spectrum} x1="0%" x2="100%" y1="58%" y2="42%">
          {brandLogo.spectrum.map(([offset, color]) => <Stop key={offset} offset={`${offset}%`} stopColor={color} />)}
        </LinearGradient>
        <LinearGradient id={bridge} x1="0%" x2="100%" y1="100%" y2="0%">
          {brandLogo.bridge.map(([offset, color, opacity]) => <Stop key={offset} offset={`${offset}%`} stopColor={color} stopOpacity={opacity} />)}
        </LinearGradient>
      </Defs>
      {variant === 'wordmark'
        ? logoPaths.optionBStars.map((d, i) => animated
          ? <TwinkleStar key={d} index={i} testID={`${testID}-star-${i}`} />
          : <Path key={d} d={d} fill={brandLogo.stars[i]} opacity={i === 0 ? 0.95 : 0.9} />)
        : <G transform={compact ? 'translate(0 -20)' : undefined}>{logoPaths.stars.map((d, i) => <Path key={d} d={d} fill={brandLogo.stars[i]} opacity={i === 0 ? 0.95 : 0.9} />)}</G>}
      {animated ? <BouncingRibbon testID={`${testID}-loop`}>{ribbon}</BouncingRibbon> : ribbon}
      {/* At 32pt the compact lockup keeps 9pt lettering, as in Stitch's header example. */}
      {wordmark ? <SvgText testID={`${testID}-text`} x={200} y={compact ? 370 : 324} textAnchor="middle" fill={theme.text.neutralPrimary} fontFamily={fontFamily.extraBold} fontSize={compact ? 112.5 : 52} letterSpacing={3.5}>{t('splash.wordmark')}</SvgText> : null}
      {variant === 'wordmark' ? brandLogo.dots.map((color, i) => animated ? <WavingDot key={color} index={i} testID={`${testID}-dot-${i}`} /> : <Circle testID={`${testID}-dot-${i}`} key={color} cx={180 + i * 20} cy={354} r={3.8} fill={color} />) : null}
    </Svg>
  </View>
}
