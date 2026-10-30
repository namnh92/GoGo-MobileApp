# shellcheck shell=bash
#
# The Sentry two-state rule for release builds (GoGo-MobileApp#340, ADR-0011
# D-5 phase 2), shared by scripts/release-build.sh and the Firebase lanes
# (GoGo-MobileApp#391). Source it from the repository root, then:
#
#   sentry_upload_env <ios|android>   check, then export the four switches
#   sentry_print_switches             print them as KEY=value (lanes parse this)
#
# Two states, nothing in between:
#   SENTRY_AUTH_TOKEN set    the build uploads the JS source map (and dSYMs on
#                            iOS); a failed upload fails the build.
#   SENTRY_AUTH_TOKEN unset  the build ships unsymbolicated, with one warning.
# A refusal prints one line and returns non-zero; the caller exits.

_sentry_refuse() {
  echo "${SENTRY_RULE_PREFIX:-release-build}: $*" >&2
  return 1
}

sentry_upload_env() {
  local platform="$1"

  # Each of these turns part of the upload off while the build still succeeds — a
  # third state between "uploaded" and "said it did not". SENTRY_DISABLE_AUTO_UPLOAD
  # is the one switch, and this function sets it itself.
  local knob
  for knob in SENTRY_ALLOW_FAILURE SENTRY_DISABLE_XCODE_DEBUG_UPLOAD SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD; do
    [[ -z "${!knob:-}" ]] || { _sentry_refuse "${knob} is not allowed: an upload either happens and must succeed, or the token is absent"; return 1; }
  done
  # sentry-xcode.sh reads this file on its own if it exists; a token kept there
  # outlives the build and travels with the working tree.
  [[ ! -e .env.sentry-build-plugin ]] || { _sentry_refuse ".env.sentry-build-plugin exists — delete it; the token comes from exec-with.sh only"; return 1; }
  # The Xcode phases source these three files *after* these checks (the bundle
  # phase inline, the dSYM phase through react-native's with-environment.sh),
  # so a SENTRY_* line in any of them would re-create exactly the state refused
  # above, or hand the build a token kept in a file. They exist to set
  # NODE_BINARY and nothing else.
  local xcode_env
  for xcode_env in ios/.xcode.env ios/.xcode.env.local ios/.xcode.env.updates; do
    if [[ -f "$xcode_env" ]] && grep -q 'SENTRY_' "$xcode_env"; then
      _sentry_refuse "${xcode_env} mentions SENTRY_ — Xcode sources it after this script's checks; remove that line (the token comes from exec-with.sh, the switches from this script)"
      return 1
    fi
  done
  # `expo run` loads the project's dotenv files (@expo/env: .env, .env.local,
  # .env.<mode>, .env.<mode>.local) after these checks and before the native
  # build starts, so a SENTRY_* assignment there — a switch, or the token kept in
  # a file — reaches the upload scripts unchecked. What counts as an assignment
  # is decided by the parser @expo/env itself uses (dotenv also accepts
  # `KEY: value`), via scripts/lib/dotenv-sentry-keys.mjs, which prints names only.
  # EXPO_PUBLIC_SENTRY_DSN is app config, not a build switch, and does not match.
  # .env.example is never loaded.
  local dotenv dotenv_files=() offending rc
  local restore_nullglob
  restore_nullglob="$(shopt -p nullglob)"
  shopt -s nullglob
  for dotenv in .env .env.*; do
    [[ "$dotenv" == .env.example ]] && continue
    [[ -f "$dotenv" ]] && dotenv_files+=("$dotenv")
  done
  eval "$restore_nullglob"
  if ((${#dotenv_files[@]})); then
    offending=$(node scripts/lib/dotenv-sentry-keys.mjs "${dotenv_files[@]}") && rc=0 || rc=$?
    if ((rc == 1)); then
      _sentry_refuse "$(cut -f1 <<<"$offending" | sort -u | paste -sd, -) sets a SENTRY_ variable ($(cut -f2 <<<"$offending" | paste -sd, -)) — Expo loads it after this script's checks; remove that line (the token comes from exec-with.sh, the switches from this script)"
      return 1
    elif ((rc != 0)); then
      _sentry_refuse "could not check the dotenv files with Expo's parser (exit ${rc})"
      return 1
    fi
  fi

  if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
    [[ "${SENTRY_DISABLE_AUTO_UPLOAD:-}" != "true" ]] \
      || { _sentry_refuse "SENTRY_AUTH_TOKEN is set and SENTRY_DISABLE_AUTO_UPLOAD=true — pick one"; return 1; }
    # A native project generated before the plugin existed builds green and
    # uploads nothing. Missing directories are fine: `expo run` generates them
    # with the plugin. The check is the one CI runs (scripts/lib/sentry-native.mjs).
    if [[ -d "$platform" ]] && ! node scripts/lib/sentry-native.mjs . "$platform"; then
      _sentry_refuse "${platform}/ is not wired to upload (above) — it predates the Sentry plugin; run: npx expo prebuild -p ${platform} --clean"
      return 1
    fi
    export SENTRY_DISABLE_AUTO_UPLOAD=false
  else
    export SENTRY_DISABLE_AUTO_UPLOAD=true
    echo "${SENTRY_RULE_PREFIX:-release-build}: warning: no SENTRY_AUTH_TOKEN — this release build will not be symbolicated in Sentry" >&2
  fi
  # Every switch gets its final value here. The SDK only acts on the literal
  # "true", and nothing loaded later (@expo/env never overrides a variable that
  # is already set) can change a value defined now.
  export SENTRY_ALLOW_FAILURE=false SENTRY_DISABLE_XCODE_DEBUG_UPLOAD=false SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=false
}

sentry_print_switches() {
  printf 'SENTRY_DISABLE_AUTO_UPLOAD=%s\nSENTRY_ALLOW_FAILURE=%s\nSENTRY_DISABLE_XCODE_DEBUG_UPLOAD=%s\nSENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=%s\n' \
    "$SENTRY_DISABLE_AUTO_UPLOAD" "$SENTRY_ALLOW_FAILURE" "$SENTRY_DISABLE_XCODE_DEBUG_UPLOAD" "$SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD"
}
