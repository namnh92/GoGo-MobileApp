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
#                            iOS); a failed upload fails the build. The SDK's own
#                            dSYM phase script exits 0 on failure — the repo
#                            patches it (patches/@sentry__react-native@8.30.0.patch).
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

# The two-state rule and every refusal around it live in one place, shared with
# the Firebase lanes (scripts/distribute.sh, GoGo-MobileApp#391).
# shellcheck source=lib/sentry-upload-env.sh
source scripts/lib/sentry-upload-env.sh
sentry_upload_env "$platform" || exit 1

if [[ "$platform" == ios ]]; then
  exec npx expo run:ios --configuration Release "$@"
fi
exec npx expo run:android --variant release "$@"
