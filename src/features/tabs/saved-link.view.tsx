import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useResolveGoogleMapsLink, useToggleSaved } from '@/shared/api'
import { track } from '@/shared/analytics'
import { mapsUrlSchema } from '@/features/place-import/maps-url'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { Text } from '@/shared/ui/text'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { TextInput } from '@/shared/ui/text-input'
import { styles } from './saved.style'

/** Resolving never submits a new venue; new links continue through the shared wizard. */
export function SavedLink({ onFeedback }: { onFeedback: (message: string) => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failed, setFailed] = useState(false)
  const resolve = useResolveGoogleMapsLink()
  const toggle = useToggleSaved()
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  async function save() {
    if (busy.current) return
    const parsed = mapsUrlSchema.safeParse(url)
    setInvalid(!parsed.success)
    if (!parsed.success) return
    busy.current = true
    setPending(true)
    try {
      const result = await resolve.mutateAsync({ url: parsed.data })
      if (!active.current) return
      if (result.status === 'ALREADY_EXISTS' && result.existingPlaceId) {
        await toggle.mutateAsync({ type: 'place', id: result.existingPlaceId, saved: false })
        track('place_saved', { source: 'saved_link' })
        if (!active.current) return
        onFeedback(t('saved.feedback.saved'))
        setUrl('')
      } else {
        router.push({ pathname: '/places/import', params: { url: parsed.data } })
      }
    } catch { if (active.current) setFailed(true) }
    finally { busy.current = false; if (active.current) setPending(false) }
  }
  return <View style={styles.linkCard}>
    <View style={styles.linkRow}>
      <MaterialIcon name="link" size={18} color="text.secondary" />
      <TextInput testID="saved-link-input" value={url} onChangeText={value => { setUrl(value); setInvalid(false) }} editable={!pending}
        accessibilityLabel={t('placeImport.linkLabel')} placeholder={t('saved.linkPlaceholder')} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.linkInput} />
      <PrimaryBtn label={t('saved.saveLink')} style={styles.linkButton} onPress={() => void save()} loading={pending} disabled={pending || !url.trim()} />
    </View>
    {invalid ? <Text variant="caption" color="status.dangerText">{t('saved.googleOnly')}</Text> : null}
    <ResultSheet visible={failed} variant="error" title={t('saved.linkFailed')} body={t('saved.retryBody')}
      primaryAction={{ label: t('common.retry'), onPress: () => { setFailed(false); void save() } }} onClose={() => setFailed(false)} />
  </View>
}
