# Firebase App Distribution — dev / stag builds

`scripts/distribute.sh` builds a dev (later stag) flavour and sends it to testers
through Firebase App Distribution: iOS as an Ad Hoc IPA, Android as an APK signed
with the environment's keystore (GoGo-MobileApp#391). prod never goes this way —
it ships through TestFlight / Play internal (#350/#351).

```bash
scripts/distribute.sh dev ios     --groups dev-testers
scripts/distribute.sh dev android --groups dev-testers
```

Tester group: `dev-testers` in Firebase project `gogo-dev-16ded` (App Distribution →
Testers & Groups). A tester joins by being added to that group there.

## Prerequisites (once per machine)

1. **Ruby** from `.ruby-version`, precompiled under `$HOME` (no Homebrew — brew
   upgrades shared libraries other tools depend on):

   ```bash
   curl https://mise.run | sh
   MISE_RUBY_COMPILE=false ~/.local/bin/mise install ruby@$(cat .ruby-version)
   ```

   The script finds it through `mise where`; nothing is activated in your shell.
2. **Gems**: `PATH="$(~/.local/bin/mise where ruby@$(cat .ruby-version))/bin:$PATH" bundle install`
   (installs into `vendor/bundle`, lockfile frozen).
3. **Node modules**: `pnpm install --frozen-lockfile`.
4. **GoGo-Infra** checked out next to this repository (or `GOGO_INFRA_DIR`), and an AWS
   session for account 665333092935, region ap-southeast-1 (`AWS_PROFILE=gogobootstrap`,
   `aws sso login`). The script refuses any other account or region.
5. **Inputs not yet in SSM** (GoGo-Infra#291): copy `scripts/distribute.inputs.example`
   to `~/.config/gogo-distribute/inputs.env`, fill `APPLE_TEAM_ID` and the Tenjin SDK
   keys, `chmod 600`.
6. **iOS**: an unlocked GUI session (codesign uses the login keychain), Xcode, and the
   Apple Distribution identity in the login keychain — see *Signing identity* below.

## What a run does

1. Refuses prod, unknown arguments, and any signing/Sentry/fastlane variable already
   set in your shell (`CERT_*`, `SIGH_*`, `SENTRY_*`, `FASTLANE_*`, …). Unset them.
2. Checks the AWS account and the effective region, a clean working tree, and that no
   `.env*` file sits in the repo root or `fastlane/`.
3. Takes a per-machine lock (`~/.local/state/gogo-distribute/<env>-<platform>.lock`) and
   writes the public app config there — never into the worktree.
4. Runs GoGo-Infra `exec-with.sh`, which fetches the signing, Firebase, Maps and Sentry
   rows and starts fastlane. fastlane moves them into memory before anything else runs;
   each build step gets only the variables it needs.
5. Build number: Firebase's latest for that app + 1 (`--build-number N` must be higher).
   Re-checked just before upload.
6. Upload to the groups, release notes `<flavour> <sha7> build <n> (<branch>) host=<machine>`.

One workstation uploads to a given Firebase app at a time (owner decision 2026-10-29,
Q-13). The lock covers this machine; a second machine is a decision, not a fix.

## Signing identity (iOS)

One Apple Distribution certificate serves the team; its private key lives in a login
keychain and in the password manager, never in SSM or the repository (GoGo-Infra#271).

- **First signing ever** (App Store Connect has no Apple Distribution certificate), owner
  present: `scripts/distribute.sh dev ios --groups dev-testers --first-signing --provision-only`.
  Then export it at once: Keychain Access → login → My Certificates → Apple Distribution →
  Export → `.p12` with a password → password manager.
- **Another of the owner's machines**: import that `.p12` into its login keychain
  (Keychain Access → File → Import). The lane refuses to mint a second certificate when
  App Store Connect has one this keychain lacks.
- **New tester iPhone**: register its UDID (Apple Developer → Devices), then run again —
  the lane regenerates both Ad Hoc profiles (app + notification extension) every run.
- `--provision-only` stops after the certificate and profiles: the quick way to check the
  App Store Connect key and a new device.
- **HTTP 403** on certificate/profile creation: the key `gogo-lane-<env>` lacks the role.
  The lane prints the fix: a new Team key with role Admin, `put.sh` its three rows, revoke
  the old key, re-run.

## Sentry

Same two states as `scripts/release-build.sh` (shared in `scripts/lib/sentry-upload-env.sh`):
with the token row the build uploads source maps and dSYMs and a failed upload fails the
build; `--without-symbols` ships unsymbolicated, with one warning. A distributed build
reports `release = <commit sha>`, `dist = <build number>`.

## After a run

- Output: `fastlane/build/<platform>/` (ignored). The lock directory is removed.
- Interrupted run (Ctrl-C, TERM): child builds are stopped before any file is removed.
  If the machine lost power instead, the next run recovers the stale lock, or names the
  process groups still running.
- Android check: `apksigner verify --print-certs fastlane/build/android/*.apk` shows the
  environment keystore's SHA-1, not the debug one.
