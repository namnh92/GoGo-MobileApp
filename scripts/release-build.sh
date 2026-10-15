#!/usr/bin/env bash
#
# Release build with Sentry symbol upload (GoGo-MobileApp#340, ADR-0011 D-5
# phase 2). Run it through GoGo-Infra, which puts the upload token in this
# process's environment and nowhere else:
#
#   ../GoGo-Infra/scripts/secrets/exec-with.sh dev sentry/mobile-auth-token -- \
#     scripts/release-build.sh ios --device <udid>
#   ... -- scripts/release-build.sh android --device <serial>
#
# Two states, nothing in between:
#   SENTRY_AUTH_TOKEN set    the build uploads the JS source map (and dSYMs on
#                            iOS); a failed upload fails the build.
#   SENTRY_AUTH_TOKEN unset  the build ships unsymbolicated, with one warning.
# SENTRY_ALLOW_FAILURE is refused: it turns an unreadable release into a line
# in a log nobody reads.
#
# Remaining arguments go to `expo run:<platform>`; the configuration is pinned
# here, because the upload scripts skip silently for any configuration whose
# name contains "debug".

set -euo pipefail

# Tracing would print SENTRY_AUTH_TOKEN the first time it is expanded, into the
# build log kept as evidence. Refuse before any expansion.
case "$-" in
  *x*) echo "release-build: refusing to run with shell tracing enabled — 'set +x', then re-run." >&2; exit 1 ;;
esac

die() {
  echo "release-build: $*" >&2
  exit 1
}

usage="usage: scripts/release-build.sh <ios|android> [expo run args...]"
platform="${1:-}"
case "$platform" in
  ios | android) shift ;;
  *) die "$usage" ;;
esac

for arg in "$@"; do
  case "$arg" in
    --configuration* | --variant*) die "the build configuration is fixed to Release; drop ${arg}" ;;
  esac
done

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Each of these turns part of the upload off while the build still succeeds — a
# third state between "uploaded" and "said it did not". SENTRY_DISABLE_AUTO_UPLOAD
# is the one switch, and this script sets it itself.
for knob in SENTRY_ALLOW_FAILURE SENTRY_DISABLE_XCODE_DEBUG_UPLOAD SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD; do
  [[ -z "${!knob:-}" ]] || die "${knob} is not allowed: an upload either happens and must succeed, or the token is absent"
done
# sentry-xcode.sh reads this file on its own if it exists; a token kept there
# outlives the build and travels with the working tree.
[[ ! -e .env.sentry-build-plugin ]] || die ".env.sentry-build-plugin exists — delete it; the token comes from exec-with.sh only"

if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  [[ "${SENTRY_DISABLE_AUTO_UPLOAD:-}" != "true" ]] \
    || die "SENTRY_AUTH_TOKEN is set and SENTRY_DISABLE_AUTO_UPLOAD=true — pick one"
  # A native project generated before the plugin existed builds green and
  # uploads nothing. Missing directories are fine: `expo run` generates them
  # with the plugin. The check is the one CI runs (scripts/lib/sentry-native.mjs).
  if [[ -d "$platform" ]] && ! node scripts/lib/sentry-native.mjs . "$platform"; then
    die "${platform}/ is not wired to upload (above) — it predates the Sentry plugin; run: npx expo prebuild -p ${platform} --clean"
  fi
else
  export SENTRY_DISABLE_AUTO_UPLOAD=true
  echo "release-build: warning: no SENTRY_AUTH_TOKEN — this release build will not be symbolicated in Sentry" >&2
fi

if [[ "$platform" == ios ]]; then
  exec npx expo run:ios --configuration Release "$@"
fi
exec npx expo run:android --variant release "$@"
