import { BlockingLoadingOverlay, useSubmitOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useToggleSaved } from '@/shared/api'
import { track } from '@/shared/analytics'
import { getSessionGeneration, subscribeToSession } from '@/shared/api/session'
import { createImportFlowController } from '@/features/place-import/import-flow-controller'
import { prepareSavedLinkHandoff, type SavedLinkHandoff } from '@/features/place-import/saved-link-handoff'
import { mapsUrlSchema } from '@/features/place-import/maps-url'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import type { TextInputRef } from '@/shared/ui/text-input'
import { LinkInput } from '@/shared/ui/link-input.view'
import { styles } from './saved.style'

/** Resolving never submits a new venue; new links continue through the shared wizard. */
export function SavedLink({ onFeedback }: { onFeedback: (message: string) => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [url, setUrl] = useState('')
  const inputRef = useRef<TextInputRef>(null)
  const [failed, setFailed] = useState(false)
  const [controller] = useState(createImportFlowController)
  useEffect(() => { controller.mount(); return controller.dispose }, [controller])
  const toggle = useToggleSaved()
  const active = useRef(false)
  const attempt = useRef(0)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    let epoch = getSessionGeneration()
    return subscribeToSession(() => {
      if (epoch === getSessionGeneration()) return
      epoch = getSessionGeneration()
      attempt.current += 1
      busy.current = false
      setPending(false)
      setFailed(false)
      setUrl('')
    })
  }, [])
  useFocusEffect(useCallback(() => {
    active.current = true
    return () => {
      active.current = false
      // A response from this visit stays stale even after the tab refocuses.
      attempt.current += 1
      busy.current = false
      setPending(false)
      controller.reset()
    }
  }, [controller]))
  async function save() {
    if (!active.current || busy.current) return
    const link = url.trim()
    const openImport = (value: SavedLinkHandoff) => router.push({
      pathname: '/places/import', params: { savedLink: prepareSavedLinkHandoff(value) },
    })
    const parsed = mapsUrlSchema.safeParse(link)
    if (!parsed.success) { openImport({ url: link }); return }
    busy.current = true
    setPending(true)
    const currentAttempt = ++attempt.current
    const epoch = getSessionGeneration()
    const isCurrent = () => active.current && attempt.current === currentAttempt && epoch === getSessionGeneration()
    try {
      let result
      try { result = await controller.resolveLink(parsed.data) }
      catch (error) { if (isCurrent()) openImport({ url: parsed.data, error }); return }
      if (!isCurrent() || !result) return
      if (result.status === 'ALREADY_EXISTS' && result.existingPlaceId) {
        await toggle.mutateAsync({ type: 'place', id: result.existingPlaceId, saved: false })
        track('place_saved', { source: 'saved_link' })
        if (!isCurrent()) return
        onFeedback(t('saved.feedback.saved'))
        setUrl('')
      } else {
        openImport({ url: parsed.data, resolution: result })
      }
    } catch { if (isCurrent()) setFailed(true) }
    finally { if (isCurrent()) { busy.current = false; setPending(false) } }
  }
  const overlay = useSubmitOverlay(pending)
  return <View style={styles.linkCard}>
    <BlockingLoadingOverlay visible={pending} onClosed={overlay.onClosed} />
    <View style={styles.linkRow}>
      <View style={styles.linkField}>
        <LinkInput ref={inputRef} testID="saved-link-input" clearTestID="saved-clear-link" displayTestID="saved-link-display"
          value={url} onChangeText={setUrl} editable={!pending}
          accessibilityLabel={t('placeImport.linkLabel')} placeholder={t('saved.linkPlaceholder')}
          onClear={() => { setUrl(''); inputRef.current?.focus() }} />
      </View>
      <PrimaryBtn label={t('saved.saveLink')} size="small" style={styles.linkSave} onPress={() => void save()} loading={pending} disabled={pending || !url.trim()} />
    </View>
    <ResultSheet visible={failed && overlay.closed} variant="error" title={t('saved.linkFailed')} body={t('saved.retryBody')}
      primaryAction={{ label: t('common.retry'), onPress: () => { setFailed(false); void save() } }} onClose={() => setFailed(false)} />
  </View>
}
