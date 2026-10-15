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

[[ -z "${SENTRY_ALLOW_FAILURE:-}" ]] || die "SENTRY_ALLOW_FAILURE is not allowed: a failed upload must fail the build"
# sentry-xcode.sh reads this file on its own if it exists; a token kept there
# outlives the build and travels with the working tree.
[[ ! -e .env.sentry-build-plugin ]] || die ".env.sentry-build-plugin exists — delete it; the token comes from exec-with.sh only"

if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  [[ "${SENTRY_DISABLE_AUTO_UPLOAD:-}" != "true" ]] \
    || die "SENTRY_AUTH_TOKEN is set and SENTRY_DISABLE_AUTO_UPLOAD=true — pick one"
  # A native project generated before the plugin existed builds green and
  # uploads nothing. Missing directories are fine: `expo run` generates them.
  if [[ "$platform" == ios && -d ios ]]; then
    grep -qs 'sentry-xcode.sh' ios/*.xcodeproj/project.pbxproj \
      || die "ios/ predates the Sentry plugin — run: npx expo prebuild -p ios --clean"
  fi
  if [[ "$platform" == android && -d android ]]; then
    grep -qs 'sentry.gradle' android/app/build.gradle \
      || die "android/ predates the Sentry plugin — run: npx expo prebuild -p android --clean"
  fi
else
  export SENTRY_DISABLE_AUTO_UPLOAD=true
  echo "release-build: warning: no SENTRY_AUTH_TOKEN — this release build will not be symbolicated in Sentry" >&2
fi

if [[ "$platform" == ios ]]; then
  exec npx expo run:ios --configuration Release "$@"
fi
exec npx expo run:android --variant release "$@"
