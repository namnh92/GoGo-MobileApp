import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { styles } from './import.style'

const MAX_PHOTOS = 5
// GoGo-BE#793: submitPlace currently has no photo attachment capability.
// Fail closed until the public contract supplies both capability and attachment flow.
export const submissionPhotoCapability = { upload: false } as const

export function ImportPhotos({ photos, onChange }: { photos: string[]; onChange: (photos: string[]) => void }) {
  const { t } = useTranslation()
  const [error, setError] = useState<'denied' | 'failed' | null>(null)
  const [picking, setPicking] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function pick() {
    if (busy.current || photos.length >= MAX_PHOTOS) return
    busy.current = true
    setPicking(true)
    setError(null)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!mounted.current) return
      if (!permission.granted) {
        setError('denied')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - photos.length,
        exif: false,
      })
      if (!mounted.current || result.canceled) return
      onChange([...new Set([...photos, ...result.assets.map(asset => asset.uri)])].slice(0, MAX_PHOTOS))
    } catch {
      if (mounted.current) setError('failed')
    } finally {
      busy.current = false
      if (mounted.current) setPicking(false)
    }
  }

  return (
    <View style={styles.photoSection}>
      <View style={styles.photoHeading}>
        <Text variant="introHeading" color="text.primary">{t('placeImport.photoHeading')}</Text>
        <Text variant="introCaption" color="text.secondary">{photos.length}/{MAX_PHOTOS}</Text>
      </View>
      <GhostBtn label={t('placeImport.addPhotos')} onPress={() => void pick()} loading={picking} disabled={photos.length >= MAX_PHOTOS} style={styles.photoPicker} />
      <Text variant="caption" color="text.secondary">
        {t('placeImport.photosOptional', { count: photos.length, max: MAX_PHOTOS })}
      </Text>
      {!submissionPhotoCapability.upload ? (
        <Text variant="caption" color="text.secondary">
          {t('placeImport.photosLocalOnly')}
        </Text>
      ) : null}
      <View style={styles.photoRow}>
        {photos.map((uri, index) => (
          <View key={uri} style={styles.localPhoto}>
            <Image
              testID="import-local-photo"
              source={{ uri }}
              style={styles.photoFill}
              contentFit="cover"
              cachePolicy="none"
              accessible
              accessibilityLabel={t('placeImport.localPhoto', { index: index + 1 })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('placeImport.removePhoto', { index: index + 1 })}
              style={styles.removePhoto}
              disabled={picking}
              onPress={() => onChange(photos.filter(photo => photo !== uri))}
            >
              <Icon name="x" size={20} />
            </Pressable>
          </View>
        ))}
      </View>
      {error ? (
        <Text variant="bodySmall" color="status.dangerText">
          {t(error === 'denied' ? 'placeImport.photosDenied' : 'placeImport.photosFailed')}
        </Text>
      ) : null}
    </View>
  )
}
