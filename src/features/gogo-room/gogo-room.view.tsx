import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Share, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { INVITE_CODE, INVITE_URL } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, AvatarCircle, BackHeader, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { IconUserOutline } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './gogo-room.style'

const { brand } = colors

const groupAvatars = [
  { label: 'M', background: brand.coral },
  { label: 'A', background: brand.lavender },
  { label: 'L', background: brand.mint },
]

export default function GoGoRoomScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { roomType, participantCount } = useRoom()
  const joinedCount = Math.min(3, participantCount)
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function flash(setter: (v: boolean) => void) {
    setter(true)
    timers.current.push(setTimeout(() => setter(false), 2000))
  }

  function copyCode() {
    track('gogo_invite_copied', { channel: 'code' })
    void Clipboard.setStringAsync(INVITE_CODE).catch(() => {})
    flash(setCodeCopied)
  }

  async function invite() {
    track('gogo_invite_shared', { channel: 'native_share', roomType })
    try {
      // Single share CTA → native share sheet; no hard-coded social buttons.
      await Share.share({ message: `${t('gogoRoom.title', { context: roomType })} ${INVITE_URL}`, url: INVITE_URL })
    } catch {
      await Clipboard.setStringAsync(INVITE_URL).catch(() => {})
      flash(setLinkCopied)
    }
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[8] }}>
        {roomType === 'group' ? (
          <View style={{ alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[6] }}>
            <View style={styles.avatarRow}>
              {groupAvatars.map(a => (
                <View key={a.label} style={styles.avatarWrap}>
                  <AvatarCircle label={a.label} size={56} background={a.background} />
                </View>
              ))}
              {participantCount > 3 && (
                <View style={[styles.avatarWrap, styles.morePeople]}>
                  <Text style={styles.morePeopleLabel}>+{participantCount - 3}</Text>
                </View>
              )}
            </View>
            <Text style={styles.joined}>{t('gogoRoom.joined', { joined: joinedCount, total: participantCount })}</Text>
          </View>
        ) : (
          <View style={styles.couplePair}>
            <AvatarCircle label="M" size={64} />
            <Text style={{ fontSize: 24 }}>+</Text>
            <View style={styles.emptySeat}>
              <IconUserOutline />
            </View>
          </View>
        )}

        <Text style={styles.title}>{t('gogoRoom.title', { context: roomType })}</Text>
        <Text style={styles.body}>{t('gogoRoom.body', { context: roomType })}</Text>

        <GlassCard style={styles.chipsCard}>
          {content.dateSummaryChips.map(c => (
            <View key={c} style={styles.chip}>
              <Text style={styles.chipLabel}>{c}</Text>
            </View>
          ))}
        </GlassCard>

        <GlassCard style={styles.codeCard}>
          <Text style={styles.codeCaption}>{t('gogoRoom.codeLabel')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.code}>{INVITE_CODE}</Text>
            <Pressable onPress={copyCode} style={[styles.copyBtn, codeCopied && { backgroundColor: brand.mintSoft }]}>
              <Text style={[styles.copyLabel, codeCopied && { color: brand.mint }]}>
                {codeCopied ? t('common.copied') : t('common.copy')}
              </Text>
            </Pressable>
          </View>
        </GlassCard>

        <PrimaryBtn label={linkCopied ? t('gogoRoom.linkCopied') : t('gogoRoom.invite')} onPress={invite} />
        <GhostBtn label={t('gogoRoom.previewGuest')} onPress={() => router.push(`/r/${INVITE_CODE}`)} />

        <View style={styles.noApp}>
          <View style={styles.noAppDot} />
          <Text style={styles.noAppLabel}>{t('gogoRoom.noApp', { context: roomType })}</Text>
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
