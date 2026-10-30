import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * GoGo-MobileApp#391 — `scripts/distribute.sh`, the layer that holds no secret.
 * Everything it must refuse, it refuses before GoGo-Infra's exec-with.sh runs.
 *
 * `aws`, `ruby` and GoGo-Infra are stubs: `aws` answers from STUB_* variables,
 * the Infra generators write a fixed app config, and exec-with.sh records the
 * environment and rows it was handed instead of fetching anything.
 */

const ROOT = path.resolve(__dirname, '../../../..')
const ACCOUNT = '665333092935'

let sandbox: string
let project: string
let infra: string
let home: string
let bin: string

function sh(script: string) {
  return ['#!/usr/bin/env bash', 'set -euo pipefail', script, ''].join('\n')
}

function exe(file: string, body: string) {
  writeFileSync(file, body)
  chmodSync(file, 0o755)
}

function git(...args: string[]) {
  const result = spawnSync('git', args, { cwd: project, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
}

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'distribute-'))
  project = path.join(sandbox, 'app')
  infra = path.join(sandbox, 'infra')
  home = path.join(sandbox, 'home')
  bin = path.join(sandbox, 'bin')
  for (const dir of [path.join(project, 'scripts/lib'), path.join(infra, 'scripts/secrets'), home, bin]) {
    mkdirSync(dir, { recursive: true })
  }
  cpSync(path.join(ROOT, 'scripts/distribute.sh'), path.join(project, 'scripts/distribute.sh'))
  writeFileSync(path.join(project, '.ruby-version'), '3.4.12\n')
  git('init', '-q', '-b', 'feature/test')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init')

  exe(
    path.join(bin, 'aws'),
    sh(`case "$*" in
  "configure get region") echo "\${STUB_PROFILE_REGION:-ap-southeast-1}" ;;
  "sts get-caller-identity --query Account --output text") echo "\${STUB_ACCOUNT:-${ACCOUNT}}" ;;
  *) echo "unexpected aws $*" >&2; exit 2 ;;
esac`),
  )
  exe(path.join(bin, 'ruby'), sh('exit 0'))
  exe(
    path.join(infra, 'scripts/secrets/mobile-env.py'),
    `#!/usr/bin/env python3
import sys
out = sys.argv[sys.argv.index('--out') + 1]
open(out, 'w').write('EXPO_PUBLIC_ENV=' + sys.argv[1] + '\\n')
`,
  )
  exe(path.join(infra, 'scripts/secrets/tenjin-mobile-env.py'), '#!/usr/bin/env python3\n')
  exe(
    path.join(infra, 'scripts/secrets/exec-with.sh'),
    sh(`{
  echo "env=$1"
  shift
  rows=(); while [[ "$1" != -- ]]; do rows+=("$1"); shift; done; shift
  echo "rows=\${rows[*]}"
  echo "command=$*"
  echo "names=$(compgen -e | sort | tr '\\n' ' ')"
  echo "aws_region=\${AWS_REGION:-} aws_default_region=\${AWS_DEFAULT_REGION:-}"
  echo "team=\${APPLE_TEAM_ID:-}"
} > "$RECORD"
exit "\${STUB_EXIT:-0}"`),
  )
  const inputs = path.join(home, 'inputs.env')
  writeFileSync(inputs, 'APPLE_TEAM_ID=ABCDE12345\nTENJIN_IOS_SDK_KEY_DEV=ios\nTENJIN_ANDROID_SDK_KEY_DEV=and\n')
})

afterEach(() => rmSync(sandbox, { recursive: true, force: true }))

function run(args: string[], env: Record<string, string | undefined> = {}) {
  const record = path.join(sandbox, 'record')
  rmSync(record, { force: true })
  const base: Record<string, string | undefined> = {
    PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: home,
    RECORD: record,
    GOGO_INFRA_DIR: infra,
    GOGO_DISTRIBUTE_INPUTS: path.join(home, 'inputs.env'),
  }
  const result = spawnSync('bash', [path.join(project, 'scripts/distribute.sh'), ...args], {
    cwd: project,
    env: Object.fromEntries(Object.entries({ ...base, ...env }).filter(([, v]) => v !== undefined)) as NodeJS.ProcessEnv,
    encoding: 'utf8',
  })
  const recorded = existsSync(record) ? readFileSync(record, 'utf8') : ''
  return { status: result.status, stderr: result.stderr, stdout: result.stdout, recorded }
}

const lockDir = (env = 'dev', platform = 'ios') => path.join(home, '.local/state/gogo-distribute', `${env}-${platform}.lock`)

describe('scripts/distribute.sh', () => {
  it.each(['ios', 'android'])('refuses prod for %s before any AWS call or exec-with.sh (AC-2)', platform => {
    // An aws that fails on any call: a fetch attempt would show up as its error.
    exe(path.join(bin, 'aws'), sh('echo "aws was called" >&2; exit 9'))
    const result = run(['prod', platform, '--groups', 'dev-testers'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/prod ships through the store lanes/)
    expect(result.stderr).not.toMatch(/aws was called/)
    expect(result.recorded).toBe('')
  })

  it.each([[[]], [['--groups', '']], [['--groups', 'Dev Testers']]])('requires valid --groups (%j)', extra => {
    const result = run(['dev', 'ios', ...extra])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/--groups is required/)
  })

  it.each(['CERT_FORCE', 'SENTRY_AUTH_TOKEN', 'SIGH_FORCE', 'FASTLANE_PASSWORD', 'ASC_KEY_CONTENT', 'GRADLE_OPTS'])(
    'refuses an inherited %s, naming it and never printing its value',
    name => {
      const result = run(['dev', 'ios', '--groups', 'dev-testers'], { [name]: 'inherited-value-xyz' })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(name)
      expect(result.stderr + result.stdout).not.toContain('inherited-value-xyz')
      expect(result.recorded).toBe('')
    },
  )

  it('refuses a region override in the environment even when the profile is right', () => {
    const result = run(['dev', 'ios', '--groups', 'dev-testers'], { AWS_REGION: 'us-west-2' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/region is 'us-west-2' \(from env:AWS_REGION\)/)
  })

  it('refuses a profile in another region', () => {
    const result = run(['dev', 'ios', '--groups', 'dev-testers'], { STUB_PROFILE_REGION: 'us-east-1' })
    expect(result.stderr).toMatch(/from profile/)
    expect(result.status).not.toBe(0)
  })

  it('refuses the frozen account', () => {
    const result = run(['dev', 'ios', '--groups', 'dev-testers'], { STUB_ACCOUNT: '477020169756' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/account is 477020169756/)
  })

  it('refuses a dirty tree and a dotenv file', () => {
    writeFileSync(path.join(project, 'stray.txt'), 'x')
    expect(run(['dev', 'ios', '--groups', 'dev-testers']).stderr).toMatch(/not clean/)
    rmSync(path.join(project, 'stray.txt'))
    mkdirSync(path.join(project, 'fastlane'))
    writeFileSync(path.join(project, 'fastlane/.env'), 'X=1')
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-f', 'fastlane/.env')
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'env')
    expect(run(['dev', 'ios', '--groups', 'dev-testers']).stderr).toMatch(/fastlane\/\.env exists/)
  })

  it('hands exec-with.sh the platform rows, pins the region, and passes options as lane arguments', () => {
    const result = run(['dev', 'android', '--groups', 'dev-testers'])
    expect(result.status).toBe(0)
    expect(result.recorded).toContain('env=dev\n')
    expect(result.recorded).toContain(
      'rows=signing/android-keystore signing/android-keystore-password signing/android-key-alias signing/android-key-password firebase/app-distribution-service-account firebase/app-id-android google/maps-ios-api-key google/maps-android-api-key sentry/mobile-auth-token\n',
    )
    expect(result.recorded).toContain('aws_region=ap-southeast-1 aws_default_region=ap-southeast-1')
    expect(result.recorded).toContain('team=ABCDE12345')
    expect(result.recorded).toMatch(/command=\S+\/scripts\/lib\/distribute-run\.sh android false env:dev env_file:\S+\/tmp\/mobile\.env run_dir:\S+ groups:dev-testers sha:[0-9a-f]{40} branch:feature\/test without_symbols:false\n/)
    expect(result.stdout).toMatch(/distribute: flavour=dev platform=android sha=[0-9a-f]{40}/)
    // The run directory and the lock are gone once the child has exited.
    expect(existsSync(lockDir('dev', 'android'))).toBe(false)
  })

  it('ios carries the signing rows; --without-symbols drops the Sentry row', () => {
    const result = run(['dev', 'ios', '--groups', 'dev-testers', '--without-symbols', '--provision-only'])
    expect(result.status).toBe(0)
    expect(result.recorded).toContain(
      'rows=signing/apple-asc-key signing/apple-asc-key-id signing/apple-asc-issuer-id firebase/app-distribution-service-account firebase/app-id-ios google/maps-ios-api-key google/maps-android-api-key\n',
    )
    expect(result.recorded).toMatch(/first_signing:false provision_only:true\n/)
  })

  it('propagates the child exit status and still releases the lock', () => {
    const result = run(['dev', 'ios', '--groups', 'dev-testers'], { STUB_EXIT: '7' })
    expect(result.status).toBe(7)
    expect(existsSync(lockDir())).toBe(false)
  })

  it('refuses a lock without an owner file instead of breaking it', () => {
    mkdirSync(lockDir(), { recursive: true })
    const result = run(['dev', 'ios', '--groups', 'dev-testers'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/exists without an owner file/)
    expect(existsSync(lockDir())).toBe(true)
  })

  it('refuses while the owner is alive', () => {
    mkdirSync(lockDir(), { recursive: true })
    const start = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8' }).stdout.trim().replace(/\s+/g, ' ')
    writeFileSync(path.join(lockDir(), 'owner'), `pid=${process.pid}\nstart=${start}\nhost=x\ntoken=other\n`)
    const result = run(['dev', 'ios', '--groups', 'dev-testers'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/held by a running distribute/)
    expect(existsSync(path.join(lockDir(), 'owner'))).toBe(true)
  })

  it('recovers a lock whose owner is gone — a reused pid with another start time counts as gone', () => {
    mkdirSync(path.join(lockDir(), 'tmp'), { recursive: true })
    writeFileSync(path.join(lockDir(), 'owner'), `pid=${process.pid}\nstart=Thu Jan 1 00:00:00 1970\nhost=x\ntoken=other\n`)
    writeFileSync(path.join(lockDir(), 'tmp', 'keystore.p12'), 'left behind')
    const result = run(['dev', 'ios', '--groups', 'dev-testers'])
    expect(result.status).toBe(0)
    expect(result.stderr).toMatch(/removed a stale lock/)
  })

  it('refuses recovery while a recorded build process group is still alive', () => {
    // A build child the dead run left behind, in its own process group.
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' })
    const pgid = child.pid as number
    try {
      mkdirSync(lockDir(), { recursive: true })
      writeFileSync(path.join(lockDir(), 'owner'), 'pid=999999\nstart=x\nhost=x\ntoken=other\n')
      writeFileSync(path.join(lockDir(), 'run.json'), JSON.stringify({ ruby_pid: 999999, ruby_start: 'x', pgids: [pgid] }))
      const result = run(['dev', 'ios', '--groups', 'dev-testers'])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toMatch(new RegExp(`process groups: ${pgid}`))
      expect(existsSync(lockDir())).toBe(true)
    } finally {
      process.kill(-pgid, 'SIGKILL')
    }
  })

  it('refuses shell tracing', () => {
    const result = spawnSync('bash', ['-x', path.join(project, 'scripts/distribute.sh'), 'dev', 'ios'], { encoding: 'utf8' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/shell tracing/)
  })
})
