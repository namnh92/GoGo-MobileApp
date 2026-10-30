#!/usr/bin/env bash
#
# Build a dev/stag flavour and distribute it through Firebase App Distribution
# (GoGo-MobileApp#391). The only command a person runs:
#
#   scripts/distribute.sh dev ios     --groups dev-testers
#   scripts/distribute.sh dev android --groups dev-testers
#   scripts/distribute.sh dev ios     --groups dev-testers --provision-only
#
# Options:
#   --groups a,b         Firebase tester group aliases (required)
#   --build-number N     must be above Firebase's latest; default latest + 1
#   --first-signing      iOS only: allow minting the Apple Distribution
#                        certificate when App Store Connect has none (owner present)
#   --provision-only     iOS only: certificate + Ad Hoc profiles, then stop
#   --without-symbols    no Sentry upload (the second of the two states)
#   --api-url U --web-url U   override the flavour's hosts
#
# prod never ships from here: it goes to TestFlight / Play internal through the
# store lanes (GoGo-MobileApp#350/#351, owner decision 2026-10-28).
#
# Two layers. This one holds no secret: it checks the arguments and the
# machine, takes a per-machine lock, writes the public app config to a temp
# file and runs GoGo-Infra's exec-with.sh as a foreground child. exec-with.sh
# fetches the signing and Firebase rows and execs scripts/lib/distribute-run.sh,
# which execs fastlane — the Ruby process then owns every secret, every child
# and every temp file (shape: dev/handoffs/sa-shape-mobile-391-firebase-lane.fable.md
# in the GoGo workspace, D-1, D-17, D-18).
#
# Inputs that are not in SSM yet (GoGo-Infra#291): APPLE_TEAM_ID and the Tenjin
# SDK keys, read from $GOGO_DISTRIBUTE_INPUTS (default
# ~/.config/gogo-distribute/inputs.env). Template: scripts/distribute.inputs.example.

set -euo pipefail

case "$-" in
  *x*) echo "distribute: refusing to run with shell tracing enabled — 'set +x', then re-run." >&2; exit 1 ;;
esac

die() {
  echo "distribute: $*" >&2
  exit 1
}

# GoGo-Infra#307 (2026-10-29): SSM lives in 665333092935, ap-southeast-1; the
# old account 477020169756 is frozen. A session in the wrong account or region
# makes exec-with.sh read nothing, or stale names — the one failure it cannot
# name itself.
readonly AWS_ACCOUNT_EXPECTED=665333092935
readonly AWS_REGION_EXPECTED=ap-southeast-1

# Hosts per flavour (GoGo-Infra docs/mobile-environments.md). stag is not
# provisioned yet: no default, the flags are required.
default_api_url() { case "$1" in dev) echo https://api-dev.gogo.id.vn/v1 ;; *) echo "" ;; esac; }
default_web_url() { case "$1" in dev) echo https://go-dev.gogo.id.vn ;; *) echo "" ;; esac; }

usage="usage: scripts/distribute.sh <dev|stag> <ios|android> --groups <a,b> [--build-number N] [--first-signing] [--provision-only] [--without-symbols] [--api-url U] [--web-url U]"

env_name="${1:-}"
platform="${2:-}"
# prod is refused before anything else runs — no AWS call, no SSM read, no
# typed confirmation from exec-with.sh (AC-2).
case "$env_name" in
  dev | stag) ;;
  prod) die "prod ships through the store lanes (GoGo-MobileApp#350/#351), never through Firebase" ;;
  *) die "$usage" ;;
esac
case "$platform" in
  ios | android) ;;
  *) die "$usage" ;;
esac
shift 2

groups="" build_number="" first_signing=false provision_only=false without_symbols=false
api_url="$(default_api_url "$env_name")" web_url="$(default_web_url "$env_name")"
while (($#)); do
  case "$1" in
    --groups) groups="${2:-}"; shift 2 ;;
    --build-number) build_number="${2:-}"; shift 2 ;;
    --first-signing) first_signing=true; shift ;;
    --provision-only) provision_only=true; shift ;;
    --without-symbols) without_symbols=true; shift ;;
    --api-url) api_url="${2:-}"; shift 2 ;;
    --web-url) web_url="${2:-}"; shift 2 ;;
    *) die "unknown argument: $1 — $usage" ;;
  esac
done

[[ "$groups" =~ ^[a-z0-9-]+(,[a-z0-9-]+)*$ ]] || die "--groups is required: comma-separated Firebase tester group aliases (e.g. dev-testers)"
[[ -z "$build_number" || "$build_number" =~ ^[1-9][0-9]{0,9}$ ]] || die "--build-number must be a positive integer"
if [[ "$platform" == android ]] && { $first_signing || $provision_only; }; then
  die "--first-signing and --provision-only are iOS options"
fi
[[ -n "$api_url" && -n "$web_url" ]] || die "no default hosts for ${env_name} — pass --api-url and --web-url"

cd "$(dirname "${BASH_SOURCE[0]}")/.."
repo_root="$PWD"
# ── Ambient refusal (D-17) ───────────────────────────────────────────────────
# The lane's inputs are its arguments and exec-with.sh. A variable inherited
# from the shell would either reach a child unchecked (a token, a keystore
# password) or change what fastlane does (CERT_FORCE mints a second
# certificate; fastlane reads CERT_*/SIGH_*/GYM_* for any option not given).
# The name is printed, never the value.
row_vars=(ASC_KEY_CONTENT ASC_KEY_ID ASC_ISSUER_ID ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD
  ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD FIREBASE_SERVICE_CREDENTIALS_JSON FIREBASE_APP_ID_IOS
  FIREBASE_APP_ID_ANDROID GOOGLE_MAPS_IOS_API_KEY GOOGLE_MAPS_ANDROID_API_KEY APPLE_TEAM_ID
  GOGO_ANDROID_KEYSTORE_FILE GRADLE_OPTS JAVA_TOOL_OPTIONS FIREBASE_TOKEN GOOGLE_APPLICATION_CREDENTIALS)
ambient=()
for name in "${row_vars[@]}"; do
  [[ -z "${!name+x}" ]] || ambient+=("$name")
done
while IFS= read -r name; do
  case "$name" in
    SENTRY_* | CERT_* | SIGH_* | GYM_* | MATCH_* | SPACESHIP_* | FASTLANE_* | PILOT_* | DELIVER_* | SUPPLY_*) ambient+=("$name") ;;
  esac
done < <(compgen -e)
((${#ambient[@]} == 0)) || die "refusing: already set in this shell: ${ambient[*]} — unset them; the lane takes its inputs from its arguments and exec-with.sh only"

# ── AWS preflight (D-19) ─────────────────────────────────────────────────────
# exec-with.sh's `aws ssm` calls carry no --region, so they follow the CLI's
# precedence: AWS_REGION, then AWS_DEFAULT_REGION, then the profile.
command -v aws >/dev/null 2>&1 || die "aws CLI not found"
if [[ -n "${AWS_REGION:-}" ]]; then
  region="$AWS_REGION" region_source=env:AWS_REGION
elif [[ -n "${AWS_DEFAULT_REGION:-}" ]]; then
  region="$AWS_DEFAULT_REGION" region_source=env:AWS_DEFAULT_REGION
else
  region="$(aws configure get region 2>/dev/null || true)" region_source=profile
fi
[[ "$region" == "$AWS_REGION_EXPECTED" ]] || die "AWS region is '${region:-unset}' (from ${region_source}); SSM lives in ${AWS_REGION_EXPECTED}"
account="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" \
  || die "no AWS session — sign in (aws sso login) with the profile for account ${AWS_ACCOUNT_EXPECTED}, e.g. AWS_PROFILE=gogobootstrap"
[[ "$account" == "$AWS_ACCOUNT_EXPECTED" ]] || die "AWS account is ${account}; SSM lives in ${AWS_ACCOUNT_EXPECTED} (GoGo-Infra#307)"
export AWS_REGION="$AWS_REGION_EXPECTED" AWS_DEFAULT_REGION="$AWS_REGION_EXPECTED"

# ── Tools ────────────────────────────────────────────────────────────────────
infra="${GOGO_INFRA_DIR:-${repo_root}/../GoGo-Infra}"
[[ -x "${infra}/scripts/secrets/exec-with.sh" ]] || die "GoGo-Infra not found at ${infra} (set GOGO_INFRA_DIR)"

# The Ruby in .ruby-version, not the system one (2.6, below fastlane's floor).
# mise installs it under $HOME; nothing is activated in the user's shell.
want_ruby="$(cat .ruby-version)"
if ! ruby -e 'exit(RUBY_VERSION == ARGV[0] ? 0 : 1)' "$want_ruby" 2>/dev/null; then
  mise_bin="$(command -v mise || echo "${HOME}/.local/bin/mise")"
  ruby_dir="$("$mise_bin" where "ruby@${want_ruby}" 2>/dev/null)" \
    || die "Ruby ${want_ruby} not found — install it: mise install ruby@${want_ruby} (docs/distribute.md)"
  export PATH="${ruby_dir}/bin:${PATH}"
fi

# ── Clean tree and dotenv files (D-8, D-9) ───────────────────────────────────
# The lane reports the SHA it built; a dirty tree would make that a lie.
dirty="$(git status --porcelain)"
[[ -z "$dirty" ]] || die "the working tree is not clean — commit or remove:"$'\n'"$dirty"
# fastlane's dotenv loading overrides variables already set, and @expo/env
# reads .env files on every expo command: either would replace the app config
# this script generates.
shopt -s nullglob
for dotenv in .env .env.* fastlane/.env fastlane/.env.*; do
  [[ "$dotenv" == .env.example || ! -e "$dotenv" ]] && continue
  die "${dotenv} exists — move it out of the repo; the lane generates its config outside the worktree"
done
shopt -u nullglob

# ── Inputs not yet in SSM (GoGo-Infra#291) ───────────────────────────────────
inputs="${GOGO_DISTRIBUTE_INPUTS:-${HOME}/.config/gogo-distribute/inputs.env}"
[[ -f "$inputs" ]] || die "missing ${inputs} — copy scripts/distribute.inputs.example there and fill it"
# Read as data, never sourced.
read_input() {
  local key="$1" line value=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^${key}=(.*)$ ]] && value="${BASH_REMATCH[1]}"
  done <"$inputs"
  printf '%s' "$value"
}
apple_team_id="$(read_input APPLE_TEAM_ID)"
[[ "$apple_team_id" =~ ^[A-Z0-9]{10}$ ]] || die "APPLE_TEAM_ID in ${inputs} must be the 10-character Apple team id"

# ── Lock and run directory (D-18) ────────────────────────────────────────────
# One run per env × platform on this machine (owner Q-13: one workstation
# uploads to a given Firebase app). $HOME, not $TMPDIR: $TMPDIR is per login
# session on macOS, so a leftover there could be invisible to the next start.
state_root="${HOME}/.local/state/gogo-distribute"
lock="${state_root}/${env_name}-${platform}.lock"
recovery="${state_root}/recovery.lock"
mkdir -p "$state_root"
chmod 700 "$state_root"
# 16 random bytes as hex; `od` reads exactly that much (a `tr | head` pipe
# dies of SIGPIPE under pipefail).
token="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
# Start time identifies a process together with its pid: a reused pid does
# not inherit a lock.
proc_start() { ps -o lstart= -p "$1" 2>/dev/null | awk '{$1=$1; print}' || true; }
self_start="$(proc_start $$)"

pid_alive_as() { # <pid> <start time>: alive and the same process (pid reuse does not count)
  [[ -n "$1" ]] && kill -0 "$1" 2>/dev/null && [[ "$(proc_start "$1")" == "$2" ]]
}
owner_field() { [[ -f "$1/owner" ]] && sed -n "s/^$2=//p" "$1/owner" | head -1 || true; }
# run.json is written by fastlane (Ruby) as one line of JSON; read it with
# python3 (already required by the generators), never with a shell parser.
run_field() { # <lock> <field>: scalar, or space-separated list
  [[ -f "$1/run.json" ]] || return 0
  python3 -c 'import json,sys
v = json.load(open(sys.argv[1])).get(sys.argv[2])
print(" ".join(str(x) for x in v) if isinstance(v, list) else ("" if v is None else v))' "$1/run.json" "$2" 2>/dev/null || true
}

write_owner() { # <dir>
  printf 'pid=%s\nstart=%s\nhost=%s\ntoken=%s\n' "$$" "$self_start" "$(hostname -s)" "$token" >"$1/owner.tmp"
  mv "$1/owner.tmp" "$1/owner"
}

take_dir_lock() { # <dir> <what>: 0 = acquired; refuses otherwise, except a dead owner → 2
  if mkdir -m 700 "$1" 2>/dev/null; then
    write_owner "$1"
    return 0
  fi
  [[ -f "$1/owner" ]] || die "$2 exists without an owner file (${1}); if no distribute is running, remove it by hand"
  if pid_alive_as "$(owner_field "$1" pid)" "$(owner_field "$1" start)"; then
    die "$2 is held by a running distribute (pid $(owner_field "$1" pid)) — wait for it"
  fi
  return 2
}

release_dir_lock() { # <dir>: only our own
  [[ "$(owner_field "$1" token)" == "$token" ]] && rm -rf "$1"
}

recover_stale() {
  take_dir_lock "$recovery" "stale-lock recovery" || die "stale-lock recovery is in progress elsewhere — retry"
  # Another starter may have recovered while we waited.
  if [[ -d "$lock" ]] && ! pid_alive_as "$(owner_field "$lock" pid)" "$(owner_field "$lock" start)"; then
    local ruby_pid ruby_start live=() pgid
    ruby_pid="$(run_field "$lock" ruby_pid)"
    ruby_start="$(run_field "$lock" ruby_start)"
    if [[ -n "$ruby_pid" ]] && pid_alive_as "$ruby_pid" "$ruby_start"; then
      release_dir_lock "$recovery"
      die "a fastlane process from an earlier run is still alive (pid ${ruby_pid}) — stop it, then re-run"
    fi
    for pgid in $(run_field "$lock" pgids); do
      pgrep -g "$pgid" >/dev/null 2>&1 && live+=("$pgid")
    done
    if ((${#live[@]})); then
      release_dir_lock "$recovery"
      die "build processes from an earlier run are still alive (process groups: ${live[*]}) — stop them, then re-run"
    fi
    local stale
    stale="${lock}.stale-$(date -u +%Y%m%dT%H%M%SZ)"
    mv "$lock" "$stale"
    find "$stale" -type f -exec rm -P {} + 2>/dev/null || true
    rm -rf "$stale"
    echo "distribute: removed a stale lock left by an earlier run (owner pid gone)" >&2
  fi
  release_dir_lock "$recovery"
}

rc=0
take_dir_lock "$lock" "the ${env_name}-${platform} lock" || rc=$?
if ((rc == 2)); then
  recover_stale
  take_dir_lock "$lock" "the ${env_name}-${platform} lock" || die "could not take the lock after recovery — retry"
fi
run_dir="$lock"
mkdir -m 700 "${run_dir}/tmp"

child=""
cleaned=false
# Process groups fastlane recorded in run.json that still have a member. Ruby
# removes a group only after it verified the group is gone, so anything left
# here is a build process that outlived it (Ruby killed, or a group that
# survived SIGKILL).
surviving_groups() {
  local pgid live=()
  for pgid in $(run_field "$run_dir" pgids); do
    pgrep -g "$pgid" >/dev/null 2>&1 && live+=("$pgid")
  done
  # `-` default: bash 3.2 (macOS /bin/bash) treats an empty array as unset under -u.
  echo "${live[*]-}"
}
cleanup() {
  $cleaned && return
  cleaned=true
  if [[ -n "$child" ]] && kill -0 "$child" 2>/dev/null; then
    kill -TERM "$child" 2>/dev/null || true
    wait "$child" 2>/dev/null || true
  fi
  # Fail closed: while a build process may still read the keystore or the
  # profiles, nothing is deleted and the lock stays — the next start names the
  # groups instead of overlapping them (D-18).
  local live
  live="$(surviving_groups)"
  if [[ -n "$live" ]]; then
    echo "distribute: build process groups still running (${live}); lock and run files kept at ${run_dir} — stop them, then re-run" >&2
    return
  fi
  # Fastlane removes its own files; this is the second, idempotent pass.
  if [[ -d "${run_dir}/tmp" ]]; then
    find "${run_dir}/tmp" -type f -exec rm -P {} + 2>/dev/null || true
  fi
  release_dir_lock "$lock"
}
trap cleanup EXIT
forward() { # <signal>
  [[ -n "$child" ]] && kill -s "$1" "$child" 2>/dev/null || true
}
trap 'forward INT' INT
trap 'forward TERM' TERM
trap 'forward HUP' HUP

# ── Public app config (D-8) ──────────────────────────────────────────────────
# Written to the run directory, never to the worktree. It is data: fastlane
# parses it against an allowlist, nothing sources it.
env_file="${run_dir}/tmp/mobile.env"
python3 "${infra}/scripts/secrets/mobile-env.py" "$env_name" --region "$AWS_REGION_EXPECTED" \
  --api-url "$api_url" --web-url "$web_url" --apns-mode production --out "$env_file" >/dev/null
python3 "${infra}/scripts/secrets/tenjin-mobile-env.py" "$env_name" --bootstrap "$inputs" --out "$env_file" >/dev/null
chmod 600 "$env_file"

sha="$(git rev-parse HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
on_origin=no
[[ -n "$(git branch -r --contains "$sha" 2>/dev/null)" ]] && on_origin=yes
echo "distribute: flavour=${env_name} platform=${platform} sha=${sha} short=${sha:0:7} branch=${branch} on_origin=${on_origin} bundle=max.gogo.${env_name} aws_account=${account} aws_region=${AWS_REGION_EXPECTED} aws_region_source=${region_source} aws_profile=${AWS_PROFILE:-unset} host=$(hostname -s)"

# ── Secrets: exec-with.sh → distribute-run.sh → fastlane ─────────────────────
rows=(signing/apple-asc-key signing/apple-asc-key-id signing/apple-asc-issuer-id
  firebase/app-distribution-service-account firebase/app-id-ios)
if [[ "$platform" == android ]]; then
  rows=(signing/android-keystore signing/android-keystore-password signing/android-key-alias
    signing/android-key-password firebase/app-distribution-service-account firebase/app-id-android)
fi
# app.config.ts needs both Maps keys whatever the platform.
rows+=(google/maps-ios-api-key google/maps-android-api-key)
$without_symbols || rows+=(sentry/mobile-auth-token)

lane_options=("env:${env_name}" "env_file:${env_file}" "run_dir:${run_dir}" "groups:${groups}"
  "sha:${sha}" "branch:${branch}" "without_symbols:${without_symbols}")
[[ -z "$build_number" ]] || lane_options+=("build_number:${build_number}")
if [[ "$platform" == ios ]]; then
  lane_options+=("first_signing:${first_signing}" "provision_only:${provision_only}")
fi

export APPLE_TEAM_ID="$apple_team_id"
# fastlane asks `locale` for the charmap unless these say UTF-8.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
"${infra}/scripts/secrets/exec-with.sh" "$env_name" "${rows[@]}" -- \
  "${repo_root}/scripts/lib/distribute-run.sh" "$platform" "$without_symbols" "${lane_options[@]}" &
child=$!
status=0
# `wait` returns early when a trapped signal arrives; keep waiting for the
# child's real exit status.
while kill -0 "$child" 2>/dev/null; do
  wait "$child" && status=0 || status=$?
done
wait "$child" 2>/dev/null && status=0 || { s=$?; ((s == 127)) || status=$s; }
child=""
if [[ -n "$(surviving_groups)" ]] && ((status == 0)); then
  status=1
fi
exit "$status"
