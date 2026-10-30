#!/usr/bin/env bash
#
# Layer 2 of scripts/distribute.sh (GoGo-MobileApp#391). exec-with.sh runs this
# with the signing, Firebase and Sentry rows exported. It must spawn nothing:
# any child started here would inherit the whole set. So it is two builtins —
# drop the Sentry token when the run is the no-symbols state, then hand the
# process to fastlane, whose first statement takes the secrets out of ENV.
#
#   distribute-run.sh <ios|android> <without_symbols:true|false> <lane option>...

set -euo pipefail

case "$-" in
  *x*) echo "distribute-run: refusing to run with shell tracing enabled" >&2; exit 1 ;;
esac

platform="$1" without_symbols="$2"
shift 2

# exec-with.sh keeps inherited variables; the second Sentry state means no
# token at all, not "the row was not asked for".
[[ "$without_symbols" == true ]] && unset SENTRY_AUTH_TOKEN

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
exec bundle exec fastlane "$platform" firebase "$@"
