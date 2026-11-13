import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, KeyboardAvoidingView, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isForbidden,
  useAssistantMessages,
  useAssistantConversation,
  useAssistantReply,
  useAssistantStatus,
  useOutgoingAssistantMessages,
  useSendAssistantMessage,
  useStopAssistantReply,
  useUploadImage,
  type AssistantConversation,
  type AssistantFollowUpSelection,
} from '@/shared/api'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import { isAssistantEntryOn } from '@/shared/config/features'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { markAssistantOpened, takeChatSavedToast } from '@/shared/store/assistantIntroStore'
import { NEW_CHAT, useAssistantDraftStore } from '@/shared/store/assistantDraftStore'
import { useKeyboardVisible } from '@/shared/ui/keyboard'
import { useToast } from '@/shared/ui/toast.view'

import { useAssistantAccount } from './assistant-entry'
import { AssistantHeader } from './assistant-header.view'
import { Composer, MAX_IMAGES, type ComposerImage } from './composer.view'
import { Conversation } from './conversation.view'
import { formatClock } from './format'
import { History } from './history.view'
import { OfflineBanner } from './offline-banner.view'
import { pickAssistantImages } from './pick-images'
import { isUserOnly } from './send-error'
import { SignInPrompt } from './sign-in-prompt.view'
import { StateNotice } from './state-notice.view'
import { Welcome } from './welcome.view'
import { UsageFooter } from './usage-footer.view'
import { styles } from './assistant.style'

/**
 * GoGo AI (GoGo-MobileApp#378, design `ScreenWelcome` / `ScreenConversation` /
 * `ScreenHistory` and the states). Opened from an entry point (#379) as a
 * full-screen stack card on iOS and Android. With the gate off the route leads
 * home; a guest or signed-out person is asked to sign in (owner decision on
 * #377: guests cannot use it).
 *
 * Server state is TanStack Query (`use-assistant`); what has not reached the
 * server — the composer text and unsent messages — is the draft store.
 */
export default function AssistantScreen() {
  if (!isAssistantEntryOn()) return <Redirect href="/" />
  return <AssistantRoot />
}

function AssistantRoot() {
  const insets = useSafeAreaInsets()
  const account = useAssistantAccount()

  // Opening clears the "New" badge for this account.
  useEffect(() => {
    if (account) markAssistantOpened(account)
  }, [account])

  return (
    <View
      testID="assistant-screen"
      style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}
    >
      {account ? <AssistantChat account={account} /> : <SignedOut />}
    </View>
  )
}

/** Replace the signed-out screen so signing in does not retain an inactive assistant. */
export const ASSISTANT_SIGN_IN_HREF = '/auth/sign-in?next=assistant'

function useSignInFromAssistant() {
  const router = useRouter()
  return useCallback(() => router.replace(ASSISTANT_SIGN_IN_HREF), [router])
}

function SignedOut() {
  const router = useRouter()
  const signIn = useSignInFromAssistant()
  return (
    <>
      <AssistantHeader onClose={() => goBackOrHome(router)} />
      <SignInPrompt onSignIn={signIn} />
    </>
  )
}

function AssistantChat({ account }: { account: string }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const signIn = useSignInFromAssistant()
  const toast = useToast()
  const online = useOnlineStatus()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardVisible()
  const params = useLocalSearchParams<{ placeId?: string; placeName?: string; question?: string }>()
  const [context, setContext] = useState(
    params.placeId && params.placeName ? { placeId: params.placeId, name: params.placeName } : null,
  )
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [images, setImages] = useState<ComposerImage[]>([])

  const status = useAssistantStatus()
  const { refetch: refetchStatus } = status
  useFocusEffect(useCallback(() => { void refetchStatus() }, [refetchStatus]))
  const conversation = useAssistantConversation(conversationId)
  const { refetch: refetchConversation } = conversation
  useFocusEffect(useCallback(() => { if (conversationId) void refetchConversation() }, [conversationId, refetchConversation]))
  const messages = useAssistantMessages(conversationId)
  const outgoing = useOutgoingAssistantMessages(conversationId)
  const { send, retry } = useSendAssistantMessage(conversationId, setConversationId)
  const items = messages.data?.pages.flatMap(page => page.items) ?? []
  const streaming = items.find(message => message.role === 'assistant' && message.status === 'streaming') ?? null
  const reply = useAssistantReply(conversationId, streaming)
  const stop = useStopAssistantReply(conversationId)
  const upload = useUploadImage()

  const draftKey = conversationId ?? NEW_CHAT
  const draft = useAssistantDraftStore(state => state.drafts[draftKey] ?? '')
  const setDraft = useCallback((text: string) => useAssistantDraftStore.getState().setDraft(draftKey, text), [draftKey])

  // "Chat saved in GoGo AI history", once per account, on the first close of a real chat (#379).
  const closing = useRef({ hasChat: false, toast, t })
  useEffect(() => {
    closing.current = { hasChat: conversationId !== null, toast, t }
  }, [conversationId, toast, t])
  useEffect(
    () => () => {
      const { hasChat, toast: api, t: translate } = closing.current
      if (takeChatSavedToast(account, hasChat)) api.show(translate('assistant.chatSaved'))
    },
    [account],
  )

  // Android back from History returns to the chat, not out of GoGo AI.
  useEffect(() => {
    if (view !== 'history') return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setView('chat')
      return true
    })
    return () => subscription.remove()
  }, [view])

  const state = status.data?.state
  const limited = state === 'limit_reached'
  const insufficient = state === 'insufficient_credit'
  const paidUnavailable = state === 'disabled' && status.data?.paidSendEnabled === false && status.data.remainingToday === 0
  const disabledByServer = state !== undefined && state !== 'enabled'
  const sending = outgoing.some(item => item.status === 'sending')
  const sendDisabled = !online || disabledByServer || sending
  const locale = i18n.language === 'en' ? 'en' : 'vi'

  const submit = useCallback(
    (text: string, followUp?: AssistantFollowUpSelection) => {
      const trimmed = text.trim()
      if (!trimmed || sendDisabled) return
      const ready = images.filter((image): image is { uri: string; uploadKey: string } => image.uploadKey !== null)
      const sentImages = images
      void send({
        text: trimmed,
        locale,
        ...(followUp ? { followUp } : {}),
        ...(context ? { context: { placeId: context.placeId } } : {}),
        images: ready,
      }).then(result => {
        if (!result?.accepted) return
        const store = useAssistantDraftStore.getState()
        // A 202 clears only the revision that was accepted. Refusals retain all input.
        if (store.drafts[draftKey] === text) store.setDraft(draftKey, '')
        if (result.conversationId && store.drafts[result.conversationId] === text) store.setDraft(result.conversationId, '')
        setImages(current => current.filter(image => !sentImages.includes(image)))
      })
    },
    [context, draftKey, images, locale, send, sendDisabled],
  )

  // A starter question tapped on the place card is sent once, with the place attached.
  const askedFromEntry = useRef(false)
  useEffect(() => {
    const question = typeof params.question === 'string' ? params.question.trim() : ''
    if (askedFromEntry.current || !question || !status.isSuccess) return
    askedFromEntry.current = true
    if (!disabledByServer && online) submit(question)
  }, [params.question, status.isSuccess, disabledByServer, online, submit])

  const attach = async () => {
    const result = await pickAssistantImages(MAX_IMAGES - images.length)
    if (result.status === 'denied') {
      toast.show(t('assistant.composer.photoDenied'))
      return
    }
    if (result.status !== 'picked') return
    for (const image of result.images) {
      setImages(current => [...current, { uri: image.uri, uploadKey: null }])
      upload.mutate(
        { image, purpose: 'assistant_image' },
        {
          onSuccess: key => setImages(current => current.map(item => (item.uri === image.uri ? { ...item, uploadKey: key } : item))),
          onError: () => {
            setImages(current => current.filter(item => item.uri !== image.uri))
            toast.show(t('assistant.composer.uploadFailed'))
          },
        },
      )
    }
  }

  const close = () => goBackOrHome(router)
  const newChat = () => {
    setConversationId(null)
    setContext(null)
    setImages([])
    setView('chat')
  }
  const openConversation = (conversation: AssistantConversation) => {
    setConversationId(conversation.id)
    setContext(null)
    setImages([])
    setView('chat')
  }

  // A guest session (`403 USER_ONLY` from any call) is asked to sign in.
  if ((isForbidden(status.error) && isUserOnly(status.error)) || outgoing.some(item => isUserOnly(item.error))) {
    return (
      <>
        <AssistantHeader onClose={close} />
        <SignInPrompt onSignIn={signIn} />
      </>
    )
  }

  if (view === 'history') {
    return (
      <History activeId={conversationId} onBack={() => setView('chat')} onOpen={openConversation} onNewChat={newChat} />
    )
  }

  const welcome = conversationId === null && outgoing.length === 0
  const generating = streaming !== null
  const unavailable = disabledByServer ? (
    <StateNotice
      kind="info"
      icon={limited ? 'clock' : 'info'}
      title={insufficient ? t('assistant.credit.insufficient') : paidUnavailable ? t('assistant.credit.paidUnavailable') : limited ? t('assistant.notice.limit.title') : t('assistant.notice.disabled.title')}
      body={
        insufficient && status.data
          ? status.data.paidCreditsRequired === null ? t('credits.unknown') : t('assistant.credit.requiredAvailable', { required: status.data.paidCreditsRequired, available: status.data.creditAvailable })
          : paidUnavailable ? t('assistant.credit.paidUnavailableBody')
          : limited && status.data
          ? t('assistant.notice.limit.body', { time: formatClock(status.data.resetsAt) })
          : t('assistant.notice.disabled.body')
      }
    />
  ) : null

  const hint = !online
    ? t('assistant.composer.offlineHint')
    : disabledByServer
      ? t('assistant.composer.unavailableHint')
      : generating
        ? t('assistant.composer.stopHint')
        : welcome
          ? t('assistant.composer.disclaimer')
          : undefined

  return (
    <>
      <AssistantHeader
        onClose={close}
        avatar={!welcome}
        subtitle={online ? t('assistant.subtitle') : t('assistant.status.offline')}
        offline={!online}
        onHistory={() => setView('history')}
      />
      {!online ? <OfflineBanner /> : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.flex}>
          {welcome ? (
            <>
              <Welcome placeName={context?.name ?? null} onAsk={submit} disabled={sendDisabled} notice={unavailable} />
            </>
          ) : (
            <Conversation
              conversationId={conversationId}
              outgoing={outgoing}
              onRetry={localId => void retry(localId)}
              step={reply.step}
              connection={reply.connection}
              onRetryStream={reply.retry}
              sendDisabled={sendDisabled}
              footer={unavailable}
              footerReason={limited ? 'limit' : disabledByServer ? 'disabled' : null}
              actions={{
                onSend: submit,
                onOpenPlace: placeId => router.push(`/places/${placeId}`),
                onOpenPlan: planId => router.push(`/plans/${planId}`),
                onOpenRoom: roomId => router.push(`/room/${roomId}`),
              }}
            />
          )}
        </View>
        <View testID="assistant-footer" style={styles.footer(keyboard ? 0 : insets.bottom)}>
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={() => submit(draft)}
            onStop={() => streaming && stop.mutate(streaming.id)}
            stopping={stop.isPending}
            generating={generating}
            disabled={sendDisabled}
            hint={hint}
            images={images}
            onAttach={() => void attach()}
            onRemoveImage={index => setImages(current => current.filter((_, at) => at !== index))}
            context={context ? { label: context.name, onRemove: () => setContext(null) } : null}
          />
          <UsageFooter status={status} conversationCredits={conversationId === null ? null : conversation.data?.credits ?? messages.data?.pages[0]?.conversationCredits} />
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

