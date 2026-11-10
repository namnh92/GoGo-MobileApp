import { LoadingIndicator } from '@/shared/ui/loading-indicator.view'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import { useRef } from 'react'
import { Keyboard, Pressable, View } from 'react-native'
import { TextInput, type TextInputRef } from '@/shared/ui/text-input'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { GlassBar } from '@/shared/ui/glass-bar.view'
import { Icon } from '@/shared/ui/icons'
import { useKeyboardVisible } from '@/shared/ui/keyboard'
import { Text } from '@/shared/ui/text'
import { hitSlop, loadingIndicator, spacing } from '@/shared/ui/tokens'

import { ContextChip } from './context-chip.view'
import { styles } from './composer.style'

/** Images per message (contract `AssistantMessageSend.attachments`, maxItems 3). */
export const MAX_IMAGES = 3

export interface ComposerImage {
  uri: string
  /** `null` while uploading. */
  uploadKey: string | null
}

/**
 * Design system `Composer` (GoGo-MobileApp#378): attach, a field that grows
 * to five lines with the microphone inside it, and Send — which becomes Stop
 * while a reply is being written. The only glass on the screen (#295). It
 * sits in the layout under the thread, so the keyboard-avoiding view around
 * both lifts it onto the keyboard; with the keyboard up the home-indicator
 * inset is dropped.
 *
 * The microphone waits for voice input (#380, its native module needs an
 * ADR): it is drawn, disabled, and named "Voice input coming soon", so the
 * layout matches the design and a screen reader says why it does nothing.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  onStop,
  generating,
  stopping = false,
  disabled,
  hint,
  images,
  onAttach,
  onRemoveImage,
  context,
}: {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onStop: () => void
  generating: boolean
  stopping?: boolean
  /** Offline, or the assistant cannot take a message now: Send is off. */
  disabled: boolean
  hint?: string
  images: ComposerImage[]
  onAttach: () => void
  onRemoveImage: (index: number) => void
  context?: { label: string; onRemove: () => void } | null
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardVisible()
  const inputRef = useRef<TextInputRef>(null)
  const uploading = images.some(image => image.uploadKey === null)
  const canSend = !disabled && !uploading && value.trim().length > 0
  const submit = () => {
    if (!canSend || generating) return
    Keyboard.dismiss()
    inputRef.current?.blur()
    onSend()
  }
  const attachDisabled = disabled || images.length >= MAX_IMAGES

  return (
    <GlassBar testID="assistant-composer" style={[styles.bar, { paddingBottom: (keyboard ? 0 : insets.bottom) + spacing[2] }]}>
      {context ? (
        <View style={styles.context}>
          <ContextChip label={context.label} onRemove={context.onRemove} />
        </View>
      ) : null}
      {images.length > 0 ? (
        <View style={styles.images}>
          {images.map((image, index) => (
            <View key={image.uri} style={styles.image}>
              <Image cachePolicy="memory-disk" source={{ uri: image.uri, cacheKey: image.uri }} style={styles.imageFill} />
              {image.uploadKey === null ? (
                <View style={styles.imageBusy} accessibilityLabel={t('assistant.composer.uploading')} accessible>
                  <LoadingIndicator size={loadingIndicator.compactSize} />
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('assistant.composer.removeImage', { n: index + 1 })}
                hitSlop={hitSlop}
                onPress={() => onRemoveImage(index)}
                style={styles.removeBtn}
              >
                <Icon name="x" size={12} color="text.primary" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        <Pressable
          testID="assistant-attach"
          accessibilityRole="button"
          accessibilityLabel={images.length >= MAX_IMAGES ? `${t('assistant.composer.attach')}. ${t('assistant.composer.attachFull')}` : t('assistant.composer.attach')}
          accessibilityState={{ disabled: attachDisabled }}
          disabled={attachDisabled}
          onPress={onAttach}
          style={styles.round}
        >
          <Icon name="attach" size={22} color={attachDisabled ? 'text.secondary' : 'text.primary'} />
        </Pressable>
        <View style={styles.field}>
          <TextInput
            ref={inputRef}
            testID="assistant-input"
            accessibilityLabel={t('assistant.composer.label')}
            placeholder={t('assistant.composer.placeholder')}
            placeholderTextColor={theme.text.secondary}
            value={value}
            onChangeText={onChangeText}
            multiline
            submitBehavior="submit"
            onSubmitEditing={submit}
            maxLength={2000}
            style={styles.input}
          />
          <Pressable
            testID="assistant-mic"
            accessibilityRole="button"
            accessibilityLabel={t('assistant.composer.mic')}
            accessibilityState={{ disabled: true }}
            disabled
            onPress={() => {}}
            style={styles.mic}
          >
            <Icon name="mic" size={20} color="text.secondary" />
          </Pressable>
        </View>
        {generating ? (
          <Pressable
            testID="assistant-stop"
            accessibilityRole="button"
            accessibilityLabel={t('assistant.composer.stop')}
            accessibilityState={{ disabled: stopping, busy: stopping }}
            disabled={stopping}
            onPress={onStop}
            style={styles.stop}
          >
            <Icon name="stop" size={18} color="text.inverse" />
          </Pressable>
        ) : (
          <Pressable
            testID="assistant-send"
            accessibilityRole="button"
            accessibilityLabel={t('assistant.composer.send')}
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={submit}
            style={[styles.send, !canSend && styles.sendDisabled]}
          >
            <Icon name="send" size={20} color={canSend ? 'accent.onAccent' : 'text.secondary'} />
          </Pressable>
        )}
      </View>
      {hint ? <Text variant="caption" color="text.secondary" style={styles.hint}>{hint}</Text> : null}
    </GlassBar>
  )
}
