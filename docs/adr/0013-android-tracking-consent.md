# ADR 0013: Tracking consent on Android

Accepted for GoGo-MobileApp#370 (MMP-APP-004, epic #363). Shape:
`dev/handoffs/sa-shape-mobile-370-android-consent.fable.md` rev 4 (workspace), Astra
round 4 clean. Owner decisions 2026-10-20 (Q6: ask on both platforms, without waiting
for a legal opinion) and 2026-11-02 (Q1–Q8, workspace `dev/owner-decisions.md`).
Supersedes "Android: unchanged" in ADR 0012 and, on Android only, "both SDKs start on
every launch" in ADR 0011. iOS is unchanged (ATT is the consent, Tenjin `connect()`
stays at startup).

## Context

Android has no ATT. Tenjin `connect()` and Adjust `initSdk` ran as the app opened and
sent the advertising ID, App Set ID, Android ID, Play referrer and IP before anyone was
asked. The owner blocked the Android device run with a real Adjust token until a
consent step exists.

## Decision

- **Who asks and when:** one gate and one sheet, at the iOS moment (splash lifted, app
  active, a session, past sign-in and onboarding). `TrackingConsent` has two backends:
  ATT on iOS, GoGo's own record on Android (`asks: 'system' | 'app'`). On Android the
  sheet is the consent: "Cho phép", "Không cho phép"; back or a tap outside is "later",
  asked again next launch.
- **Nothing starts before `granted`:** no `initialize`, no `connect`, no `initSdk`.
  Only the install reset runs at launch, and it talks to no vendor. Denied or later:
  neither SDK runs that launch.
- **Windows start at the answer:** the Adjust sink and the Tenjin collector run after
  the decision, or they would close before a late answer could start the SDKs.
- **Record:** AsyncStorage `gogo.consent.tracking.v1`,
  `{ status, at, disclosure: 'android-consent-v1' }`, validated by zod on read. New
  wording bumps `disclosure` and the person is asked again. Local to the device, not
  the account; gone on uninstall (`allowBackup: false`).
- **Runtime first:** an answer changes the value and issues the write in one tick;
  persistence never holds a decision. Every read and write is bounded by 2 s. A failed
  grant runs this launch and is asked again next launch. A failed denial clears any
  earlier grant, and Settings shows it as unsaved with a retry. AsyncStorage's serial
  executor keeps disk order equal to issue order, so JS never queues; that prevents
  JS-side waiting only, and is not a durability guarantee.
- **Changing your mind:** Settings → Quyền và dữ liệu. Android: a switch; off is
  `Tenjin.optOut()` + `Adjust.disable()`, on starts the SDKs or `optIn()` + `enable()`.
  iOS: a button to the OS Settings. `Adjust.disable()` outlives a launch, so every
  granted start calls `enable()` after `initSdk`. Tenjin's persistence is not
  established, so every granted start calls `optIn()` before `connect()`.
- **Every start re-checks:** one generation per change of mind. After the install reset,
  after the lazy Adjust import and right before the vendor call, a start whose
  generation is no longer current stops (`acquisition_start_stale:<sdk>`).
- **Bounds:** on Android the install reset has 5 s; the whole settle chain has 20 s from
  the decision. A timeout counts as a failed reset for the rest of the launch: the
  resume reads nothing and a late completion authorises nothing. An unanswered sheet
  has no clock: nothing is waiting to open until someone is on a main screen.
- **Deferred links:** the resume waits for the answer, so the sheet never lands on an
  opened link. A person who declines has no deferred link; a non-identifying path
  through Play Install Referrer is #397.
- **Rejected:** starting the SDKs without identifiers (`disable*Reading`, Tenjin
  `optOutParams`): IP, device model and referrer still reach the vendors, the flags are
  init-time only, and a proxy could not prove the boundary. Adjust first-session delay:
  same result as not calling `initSdk`, with identifiers read into memory and no Tenjin
  equivalent. Asking before sign-in: breaks parity with the iOS moment.
- **Diagnostics, release builds too:** `consent_tracking:granted|denied|later`,
  `:stored:<status>`, `:settings:on|off`, `:store_failed:<status>`,
  `:store_cleared:denied`, `:store_skipped:stale`; `acquisition_skipped:consent_*`,
  `acquisition_adjust_skipped:consent_*`, `acquisition_start_stale:<sdk>`,
  `acquisition_settle_timed_out`, `deferred_link_install_scope_timed_out`. No identifier,
  no URL.

## Consequences

- On Android an install reaches Tenjin and Adjust only after sign-in and consent, so
  installs that never sign in are not counted and dashboard numbers lag.
- **Accepted limit (owner 2026-11-02):** a process killed, or storage broken, between a
  withdrawal and its write reaching disk reads the earlier grant next launch and starts
  the SDKs without asking. The unsaved state does not survive the process. A second
  marker would fail in the same storage, so none is built.
- Consent evidence is one local record: one answer with its wording version, no history.
  It does not prove legal sufficiency; `docs/store-privacy.md` §10 Q6 stays open.
- A grant reports whatever link the MMPs still hold; it is stored and opens on a later
  launch if the resume has already looked this launch.
- Native startup side effects, vendor endpoints and withdrawal or re-enable behaviour are
  measured on a device (#370 AC-2, AC-3), not established by these tests.

## Rollback

A consent asked for is never taken back, so rollback **fails closed**: Android
acquisition off (`Platform.OS === 'android'` starts neither SDK,
`acquisition_skipped:android_rollback`), stored answers left untouched, iOS unchanged.
Restoring unconditional Android startup is not a rollback. It is a new decision that
needs its own owner line and a new privacy declaration. `docs/store-privacy.md` §12 D-7
stays while any build that asked is in the field.
