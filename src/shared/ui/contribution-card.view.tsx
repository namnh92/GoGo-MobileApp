import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { openWebsite } from '@/shared/navigation/external-links'
import { MaterialIcon } from './material-icon'
import type { CardData } from './place-card.view'
import { Skeleton } from './skeleton.view'
import { Text } from './text'
import { styles } from './contribution-card.style'

export function ContributionReason({ reason }: { reason?: string }) {
  const { t } = useTranslation()
  return reason ? <View style={styles.reason}><MaterialIcon name="info" size={16} color="status.dangerText" />
    <Text variant="avatarCaption" color="status.dangerText" numberOfLines={1} style={styles.flex}>{t('contributions.reason', { reason })}</Text>
  </View> : null
}

/** Proxy authors are authoritative; a source is printed once even when the snapshot repeats it. */
export function ContributionCredits({ data, sourceUrl }: { data: CardData; sourceUrl?: string }) {
  const { t } = useTranslation()
  const { place } = data
  const attribution = place.photoAttribution
  const extra = data.extraCredits.filter(credit => !attribution?.includes(credit.trim()))
  if (!attribution && !extra.length) return null
  return <View style={styles.credits}>
    {attribution ? <Text testID={data.candidate ? 'import-photo-credit' : 'saved-photo-attribution'} variant="introCaption" color="text.secondary"
      accessibilityLabel={`${t('placeImport.photoCredit')}${place.photoAuthors?.map(author => author.displayName).join(', ') ?? ''} · ${attribution}`}>
      {t('placeImport.photoCredit')}{place.photoAuthors?.map((author, index) => <Text key={`${index}-${author.displayName}`} variant="introCaption"
        accessibilityRole={author.uri ? 'link' : undefined} onPress={author.uri ? () => { void openWebsite(author.uri!) } : undefined}>{index ? ', ' : ''}{author.displayName}</Text>)}
      {`${place.photoAuthors?.length ? ' · ' : ''}${attribution}`}
    </Text> : null}
    {extra.map(credit => <Text key={credit} variant="introCaption" color="text.secondary" accessibilityRole={sourceUrl ? 'link' : undefined}
      onPress={sourceUrl ? () => { void openWebsite(sourceUrl) } : undefined}>{credit}</Text>)}
  </View>
}

export function ContributionCardSkeleton({ kind }: { kind: 'places' | 'reviews' }) {
  const { t } = useTranslation()
  return <View testID={`contribution-${kind}-skeleton`} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} style={[styles.surface, styles.skeleton]}>
    {kind === 'places' ? <Skeleton width="100%" height={176} radius={16} /> : <View style={styles.skeletonRow}>
      <Skeleton style={styles.skeletonThumb} height={48} radius={12} /><Skeleton width="60%" height={16} />
    </View>}
    <Skeleton width="65%" height={16} /><Skeleton width="90%" height={12} /><Skeleton width="50%" height={12} />
  </View>
}
