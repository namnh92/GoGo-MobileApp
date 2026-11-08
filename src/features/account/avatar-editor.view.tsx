import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigation } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, BackHandler, Image, Pressable, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Svg, { Circle, Defs, G, Line, Mask, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { avatarGeometry, DEFAULT_AVATAR_ADJUSTMENT, type AvatarAdjustment } from '@/shared/media/avatar-crop'
import type { PickedAsset } from '@/shared/media/pick-avatar'
import { MaterialIcon, type MaterialIconName } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { styles } from './avatar-editor.style'

export function AvatarEditor({ asset, busy, error, onClose, onChooseAnother, onConfirm }: {
  asset: PickedAsset & { width: number; height: number }; busy: boolean; error: string | null
  onClose: () => void; onChooseAnother: () => void; onConfirm: (value: AvatarAdjustment, viewport: number) => void
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  useLayoutEffect(() => {
    // This editor replaces Account content inside the same native stack route.
    // An iOS pop would bypass the editor's close/upload guards and lose drafts.
    navigation.setOptions({ gestureEnabled: false })
    return () => navigation.setOptions({ gestureEnabled: true })
  }, [navigation])
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) onClose()
      return true
    })
    return () => subscription.remove()
  }, [busy, onClose])
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const viewport = Math.max(80, Math.min(350, width - 32, height - insets.top - insets.bottom - 350))
  const [value, setValue] = useState(DEFAULT_AVATAR_ADJUSTMENT)
  const current = useRef(value)
  const panStart = useRef(value)
  const pinchStart = useRef(value)
  const sliderWidth = useRef(1)
  function update(next: AvatarAdjustment) {
    const zoom = Math.max(1, Math.min(2.5, next.zoom))
    const geometry = avatarGeometry(asset.width, asset.height, viewport, { ...next, zoom })
    current.current = { ...next, zoom, x: geometry.x, y: geometry.y }
    setValue(current.current)
  }
  const geometry = avatarGeometry(asset.width, asset.height, viewport, value)
  // RNGH registers these callbacks; it never invokes them during render.
  /* eslint-disable react-hooks/refs */
  const pan = Gesture.Pan().enabled(!busy).maxPointers(1).runOnJS(true)
    .onStart(() => { panStart.current = current.current })
    .onUpdate(e => update({ ...current.current, x: panStart.current.x + e.translationX, y: panStart.current.y + e.translationY }))
  const pinch = Gesture.Pinch().enabled(!busy).runOnJS(true)
    .onStart(() => { pinchStart.current = current.current })
    .onUpdate(e => update({ ...current.current, zoom: pinchStart.current.zoom * e.scale }))
  const slider = Gesture.Pan().enabled(!busy).minDistance(0).runOnJS(true)
    .onBegin(e => update({ ...current.current, zoom: 1 + Math.max(0, Math.min(1, e.x / sliderWidth.current)) * 1.5 }))
    .onUpdate(e => update({ ...current.current, zoom: 1 + Math.max(0, Math.min(1, e.x / sliderWidth.current)) * 1.5 }))
  /* eslint-enable react-hooks/refs */
  return <GestureHandlerRootView style={styles.root}>
      <View onAccessibilityEscape={() => { if (!busy) onClose() }} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <EditorButton icon="close" label={t('common.close')} onPress={onClose} busy={busy} />
          <Text variant="discoveryHeading" color="onDark.strong" accessibilityRole="header" style={styles.title}>{t('account.avatarAdjust')}</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => update(DEFAULT_AVATAR_ADJUSTMENT)} style={styles.reset}>
            <Text variant="avatarReset" color="onDark.medium">{t('account.avatarReset')}</Text>
          </Pressable>
        </View>
        <View style={styles.main}>
          <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
            <View testID="avatar-crop-viewport" accessible accessibilityLabel={t('account.avatarPreview')}
              accessibilityActions={[
                { name: 'left', label: t('account.avatarMoveLeft') }, { name: 'right', label: t('account.avatarMoveRight') },
                { name: 'up', label: t('account.avatarMoveUp') }, { name: 'down', label: t('account.avatarMoveDown') },
              ]}
              onAccessibilityAction={e => { if (!busy) {
                const action = e.nativeEvent.actionName
                update({ ...value, x: value.x + (action === 'left' ? -10 : action === 'right' ? 10 : 0), y: value.y + (action === 'up' ? -10 : action === 'down' ? 10 : 0) })
              } }} style={[styles.viewport, { width: viewport, height: viewport }]}>
              <Image source={{ uri: asset.uri }} accessibilityLabel={t('account.avatarPreview')} style={{ position: 'absolute', width: asset.width * geometry.scale, height: asset.height * geometry.scale,
                left: (viewport - asset.width * geometry.scale) / 2 + geometry.x, top: (viewport - asset.height * geometry.scale) / 2 + geometry.y,
                transform: [{ scaleX: value.flipped ? -1 : 1 }, { rotate: `${value.rotation}deg` }] }} />
              <Svg width={viewport} height={viewport} viewBox="0 0 350 350" style={styles.mask} pointerEvents="none" accessibilityElementsHidden>
                <Defs><Mask id="avatar-mask"><Rect width={350} height={350} fill="white" /><Circle cx={175} cy={175} r={140} fill="black" /></Mask></Defs>
                <Rect width={350} height={350} fill="black" opacity={0.68} mask="url(#avatar-mask)" />
                <Circle cx={175} cy={175} r={140} stroke="white" strokeOpacity={0.85} strokeWidth={1.75} fill="none" />
                <G stroke="white" opacity={0.32} strokeDasharray="2 3">{[128.3, 221.7].map(n => <G key={n}><Line x1={n} x2={n} y1={43} y2={307} /><Line x1={43} x2={307} y1={n} y2={n} /></G>)}</G>
                <G stroke="white" opacity={0.75}><Circle cx={175} cy={175} r={2.5} fill="white" /><Line x1={167} x2={183} y1={175} y2={175} /><Line x1={175} x2={175} y1={167} y2={183} /></G>
              </Svg>
              <View pointerEvents="none" style={styles.hint}><MaterialIcon name="touch" size={12} color="onDark.strong" /><Text variant="avatarCaption" color="onDark.strong">{t('account.avatarGestureHint')}</Text></View>
              <View pointerEvents="none" style={styles.badge}><Text variant="introCaption" color="onDark.strong">{Math.round(value.zoom * 100)}%</Text></View>
            </View>
          </GestureDetector>
        </View>
        <View style={styles.dock}>
          <View style={styles.sliderRow}>
            <EditorButton icon="minus" label={t('account.avatarZoomOut')} onPress={() => update({ ...value, zoom: value.zoom - 0.15 })} busy={busy} />
            <GestureDetector gesture={slider}><View style={styles.sliderTouch} onLayout={e => { sliderWidth.current = e.nativeEvent.layout.width }}
              accessible accessibilityRole="adjustable" accessibilityLabel={t('account.avatarZoom')} accessibilityValue={{ min: 100, max: 250, now: Math.round(value.zoom * 100) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => { if (!busy) update({ ...value, zoom: value.zoom + (e.nativeEvent.actionName === 'increment' ? 0.15 : -0.15) }) }}>
              <View style={styles.track} /><View style={[styles.thumb, { left: `${(value.zoom - 1) / 1.5 * 100}%` }]} />
            </View></GestureDetector>
            <EditorButton icon="plus" label={t('account.avatarZoomIn')} onPress={() => update({ ...value, zoom: value.zoom + 0.15 })} busy={busy} />
            <Text variant="introCaption" color="onDark.strong">{Math.round(value.zoom * 100)}%</Text>
          </View>
          <View style={styles.tools}>
            <EditorButton icon="rotate" label={t('account.avatarRotate')} onPress={() => update({ ...value, rotation: (value.rotation + 90) % 360 })} busy={busy} tool />
            <EditorButton icon="center" label={t('account.avatarCenter')} onPress={() => update({ ...value, x: 0, y: 0 })} busy={busy} tool />
            <EditorButton icon="flip" label={t('account.avatarFlip')} onPress={() => update({ ...value, flipped: !value.flipped })} busy={busy} tool />
          </View>
          {error ? <Text color="onDark.strong" variant="introCaption" accessibilityRole="alert">{error}</Text> : null}
          <View style={styles.tools}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onChooseAnother} style={({ pressed }) => [styles.another, pressed && styles.pressed]}><MaterialIcon name="photoLibrary" color="onDark.medium" /><Text variant="avatarSecondary" color="onDark.strong" style={styles.actionText}>{t('account.avatarAnother')}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t(busy ? 'account.avatarUploading' : 'account.avatarUse')} disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => onConfirm(value, viewport)} style={({ pressed }) => [styles.confirm, pressed && styles.confirmPressed]}>
              {busy ? <ActivityIndicator color="white" /> : <MaterialIcon name="check" color="onDark.strong" />}<Text variant="avatarPrimary" color="onDark.strong" style={styles.actionText}>{t(busy ? 'account.avatarUploading' : 'account.avatarUse')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
}

function EditorButton({ icon, label, onPress, busy, tool = false }: { icon: MaterialIconName; label: string; onPress: () => void; busy: boolean; tool?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy }} disabled={busy}
    onPress={onPress} style={({ pressed }) => [tool ? styles.tool : styles.iconButton, pressed && styles.pressed]}>
    <MaterialIcon name={icon} color="onDark.strong" size={22} />{tool ? <Text variant="avatarTool" color="onDark.strong">{label}</Text> : null}
  </Pressable>
}
