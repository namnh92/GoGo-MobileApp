# ADR 0014: Android runs the MMP SDKs like iOS and withholds the advertising ID

Accepted for GoGo-MobileApp#404 (MMP-APP-005, epic #363). Shape:
`dev/handoffs/sa-shape-mobile-404-android-like-ios.fable.md` rev 5 (workspace), frozen after three
Astra rounds. Owner decisions 2026-11-03 (workspace `dev/owner-decisions.md`, #404). Supersedes in
ADR 0013: "nothing starts before granted", "windows start at the answer", the runtime half of
"changing your mind", "every start re-checks" and "rejected: starting without identifiers". Keeps
from ADR 0013: the gate and its moment, the record (now `android-consent-v2`), runtime first, the
bounds, the accepted storage limit. iOS behaviour is unchanged.

## Context

ADR 0013 kept both SDKs off until "Cho phép". Installs that never signed in went uncounted and
Android behaved differently from iOS. The owner chose iOS's behaviour on Android and ordered a spike
before the change. The spike (SM-A226B, SDK parameter logs, wire not decrypted) measured that Tenjin
`optOutParams(['advertising_id', 'ad_id_local'])` and Adjust `disableGoogleAdIdReading()` hold the
advertising ID back while App Set ID, IP and device data still go; that `Tenjin.optOut()` outlives a
launch and `optOutParams` does not undo it; and that Adjust's flags are fixed at `initSdk`.

## Decision

- **Every launch starts both SDKs,** in the iOS order: the install reset, Tenjin at once once the
  stored answer is known (bounded 2 s, then `undetermined`), Adjust after the reset and the lazy
  import, with the sink and the collector at launch. No start is abandoned.
- **Each SDK reads the answer at its own vendor call,** because they differ. Tenjin:
  `initialize → setAppStore → optIn → optOutParams unless granted → connect`; the `optIn()` lifts an
  `optOut()` a #370 build persisted. Adjust: `disableAndroidIdReading()` always,
  `disableGoogleAdIdReading()` unless granted, read right before `initSdk`, then `enable()`, which
  lifts a persisted `disable()`.
- **One path for a change of mind.** The sheet and the Settings switch both land in the consent
  store; the store's subscription runs `reconcileAndroidSdks`, which makes a vendor call only when
  it changes something. A listener hears a change after its write has been issued.
  - Not yet granted → denied, or later: no vendor call.
  - Any → granted: `Tenjin.optIn()`. A running Adjust keeps its config.
  - Granted → denied: Tenjin `optOutParams`; Adjust `disable()` only if this process's config may
    read the advertising ID.
  - Back to granted after that: `Tenjin.optIn()`, `Adjust.enable()`.
- **Android ID: never,** in every state (owner Q3). The Android set is App Set ID always plus the
  advertising ID on a yes, as iOS has IDFV plus IDFA.
- **`Tenjin.optOut()` is called nowhere** (`adjust-boundary.test.ts`).
- **Words:** the same sentences on both platforms, no vendor names and no data list on the sheet;
  the recipients and the list are on the Settings row (owner Q1, Q2). A person who answered v1 is
  asked again, since v1's "no" meant no SDK at all.
- **Rejected:** stopping the SDKs on denial (#370; owner reversed it 2026-11-03, and both stops persist
  across launches). Adjust first-session delay: the install report would wait for sign-in again.
  Re-initialising Adjust in-process to flip a flag: one `initSdk` per process. One decision per launch
  for both SDKs: loses an answer landing during the Adjust import.
- **Diagnostics, release builds too:** `acquisition_tenjin_withhold:on|off`,
  `acquisition_adjust_withhold:on|off`, `acquisition_adjust_paused:consent_withdrawn`,
  `acquisition_adjust_resumed:consent_granted`; `consent_tracking:*` as in ADR 0013. No identifier,
  no URL.

## Consequences

- App Set ID, IP, device data and install and open events reach Tenjin and Adjust before anyone is
  asked and after a refusal. The owner accepted this; the sheet says measurement continues without
  the advertising ID. Legal review (Luật Bảo vệ dữ liệu cá nhân, Nghị định 356) is still open:
  `docs/store-privacy.md` §10 Q6, §12 D-8.
- **The one asymmetry (owner Q6):** turning the switch off in a process whose Adjust config may read
  the advertising ID pauses Adjust until the next launch, which starts withheld; Tenjin is withheld at
  once. On a process that started withheld nothing pauses. The Settings hint does not mention the
  pause (owner's choice).
- **A yes is not immediate.** Tenjin gets the ID at the next launch's `connect`. Adjust needs a new
  process, which is longer than iOS, where the SDK waits up to 60 s for ATT inside its first session.
- **Known limit:** `Adjust.disable()` outlives a launch. A process killed before the next launch's
  `enable()` leaves Adjust silent until a launch completes `initSdk` and `enable()`.
- Attribution without the advertising ID is not established: the spike's `Organic` came from an
  `adb` install with no Play Install Referrer and no control. Measure on a Play internal track.
- Native startup behaviour, the `optIn() → optOutParams` order after a persisted `optOut()`, and
  withdrawal are device evidence (#404 AC-3), not established by these tests.

## Rollback

`git revert` of the #404 squash restores #370 exactly. v2 records fail #370's `z.literal` and read as
`undetermined`, so that code asks again and starts nothing before a yes: it fails closed without a
flag. Restoring this behaviour after such a revert needs a build and a new answer.
