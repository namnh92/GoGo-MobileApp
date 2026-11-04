# frozen_string_literal: true

# bundle exec ruby -Ifastlane/lib fastlane/test/gogo_distribute_test.rb
# GoGo-MobileApp#391 — the parts of the Firebase lanes that hold secrets or
# decide what ships, tested without fastlane, AWS or a build.

require 'minitest/autorun'
require 'minitest/mock'
require 'tmpdir'
require 'gogo_distribute'

GD = GogoDistribute

class EnvFileTest < Minitest::Test
  KEYS = %w[A_KEY B_KEY].freeze

  def parse(text, required: KEYS)
    GD::EnvFile.parse(text, allowlist: KEYS, required: required)
  end

  def test_keeps_values_literally
    values = parse("A_KEY=https://x/v1?a=1&b=2;rm -rf ~\nB_KEY=$(whoami) `id` ${HOME}\n")
    assert_equal 'https://x/v1?a=1&b=2;rm -rf ~', values['A_KEY']
    assert_equal '$(whoami) `id` ${HOME}', values['B_KEY']
    assert values.frozen?
  end

  def test_skips_blank_and_comment_lines
    assert_equal({ 'A_KEY' => '1', 'B_KEY' => '' }, parse("# generated\n\nA_KEY=1\nB_KEY=\n"))
  end

  def test_refuses_an_unknown_key
    error = assert_raises(GD::Refusal) { parse("A_KEY=1\nB_KEY=2\nPATH=/tmp\n") }
    assert_match(/PATH is not an expected key/, error.message)
  end

  def test_refuses_a_duplicate_key
    assert_raises(GD::Refusal) { parse("A_KEY=1\nA_KEY=2\nB_KEY=3\n") }
  end

  def test_refuses_quoted_values
    assert_raises(GD::Refusal) { parse("A_KEY=\"1\"\nB_KEY=2\n") }
    assert_raises(GD::Refusal) { parse("A_KEY='1'\nB_KEY=2\n") }
  end

  def test_refuses_shell_syntax_lines
    assert_raises(GD::Refusal) { parse("export A_KEY=1\nB_KEY=2\n") }
    assert_raises(GD::Refusal) { parse("A_KEY=1\n$(id)\nB_KEY=2\n") }
    assert_raises(GD::Refusal) { parse("a_key=1\nB_KEY=2\n") }
  end

  def test_refuses_a_missing_required_key
    error = assert_raises(GD::Refusal) { parse("A_KEY=1\n") }
    assert_match(/missing B_KEY/, error.message)
  end

  def test_app_config_allowlist_is_what_the_generators_emit
    # mobile-env.py (GoGo-Infra); a new key there must be
    # added here on purpose, not slip through.
    assert_equal 14, GD::APP_CONFIG_KEYS.size
    assert_includes GD::APP_CONFIG_KEYS, 'EXPO_PUBLIC_ENV'
    refute_includes GD::APP_CONFIG_KEYS, 'SENTRY_AUTH_TOKEN'
  end
end

class SecretsTest < Minitest::Test
  def test_capture_removes_every_secret_from_the_environment
    env = GD::SECRET_KEYS.to_h { |k| [k, "value-of-#{k}"] }.merge('PATH' => '/bin', 'HOME' => '/home/x')
    secrets = GD::Secrets.capture!(env)
    assert_equal({ 'PATH' => '/bin', 'HOME' => '/home/x' }, env)
    assert_equal 'value-of-ASC_KEY_CONTENT', secrets.fetch('ASC_KEY_CONTENT')
  end

  def test_fetch_refuses_a_value_exec_with_did_not_provide
    secrets = GD::Secrets.capture!({ 'ASC_KEY_ID' => '' })
    assert_raises(GD::Refusal) { secrets.fetch('ASC_KEY_ID') }
    assert_raises(GD::Refusal) { secrets.fetch('ASC_ISSUER_ID') }
    refute secrets.key?('ASC_KEY_ID')
  end

  def test_clear_empties_the_store
    secrets = GD::Secrets.capture!({ 'SENTRY_AUTH_TOKEN' => +'tok' })
    secrets.clear!
    refute secrets.key?('SENTRY_AUTH_TOKEN')
  end
end

class EnvSetsTest < Minitest::Test
  def secrets
    GD::Secrets.capture!({
      'GOOGLE_MAPS_IOS_API_KEY' => 'mi', 'GOOGLE_MAPS_ANDROID_API_KEY' => 'ma',
      'ASC_KEY_CONTENT' => 'pem', 'ANDROID_KEYSTORE_PASSWORD' => 'pw', 'FIREBASE_SERVICE_CREDENTIALS_JSON' => '{}',
      'SENTRY_AUTH_TOKEN' => 'tok'
    })
  end

  def test_base_carries_only_the_named_variables
    base = GD::EnvSets.base({ 'PATH' => '/bin', 'HOME' => '/h', 'ASC_KEY_CONTENT' => 'x', 'RUBYOPT' => '-rbundler/setup',
                              'BUNDLE_GEMFILE' => '/g' }, default_sdk: '/nonexistent')
    assert_equal({ 'PATH' => '/bin', 'HOME' => '/h', 'EXPO_NO_TELEMETRY' => '1' }, base)
  end

  def test_android_sdk_defaults_to_android_studio_location_only_when_unset
    Dir.mktmpdir do |sdk|
      assert_equal sdk, GD::EnvSets.base({ 'PATH' => '/bin' }, default_sdk: sdk)['ANDROID_HOME']
      assert_equal '/own', GD::EnvSets.base({ 'ANDROID_HOME' => '/own' }, default_sdk: sdk)['ANDROID_HOME']
      refute GD::EnvSets.base({ 'ANDROID_SDK_ROOT' => '/root' }, default_sdk: sdk).key?('ANDROID_HOME')
    end
    refute GD::EnvSets.base({}, default_sdk: '/nonexistent').key?('ANDROID_HOME')
  end

  def test_app_config_adds_maps_team_build_and_sha_and_nothing_secret
    cfg = GD::EnvSets.app_config({ 'EXPO_PUBLIC_ENV' => 'dev', 'APPLE_TEAM_ID' => 'ABCDE12345' }, secrets: secrets, build_number: 7,
                                                                 sha: 'a' * 40, platform: 'android')
    assert_equal %w[ANDROID_VERSION_CODE APPLE_TEAM_ID EXPO_PUBLIC_ENV GOGO_BUILD_SHA GOOGLE_MAPS_ANDROID_API_KEY
                    GOOGLE_MAPS_IOS_API_KEY], cfg.keys.sort
    assert_equal '7', cfg['ANDROID_VERSION_CODE']
  end

  def test_ios_gets_the_ios_build_number
    cfg = GD::EnvSets.app_config({}, secrets: secrets, build_number: 3, sha: 'b' * 40, platform: 'ios')
    assert_equal '3', cfg['IOS_BUILD_NUMBER']
    refute cfg.key?('ANDROID_VERSION_CODE')
  end

  def test_sentry_set_is_the_switches_plus_the_token_only
    switches = { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'false' }
    assert_equal %w[SENTRY_AUTH_TOKEN SENTRY_DISABLE_AUTO_UPLOAD], GD::EnvSets.sentry(secrets, switches).keys.sort
    without = GD::Secrets.capture!({})
    assert_equal switches, GD::EnvSets.sentry(without, switches)
  end
end

class BuildNumberTest < Minitest::Test
  def test_defaults_to_latest_plus_one
    assert_equal 1, GD::BuildNumber.resolve(latest: 0)
    assert_equal 13, GD::BuildNumber.resolve(latest: 12)
  end

  def test_accepts_a_requested_number_above_latest
    assert_equal 20, GD::BuildNumber.resolve(latest: 12, requested: '20')
  end

  def test_refuses_a_requested_number_at_or_below_latest
    assert_raises(GD::Refusal) { GD::BuildNumber.resolve(latest: 12, requested: '12') }
    assert_raises(GD::Refusal) { GD::BuildNumber.resolve(latest: 12, requested: '3') }
  end

  def test_refuses_upload_when_latest_moved_up_meanwhile
    GD::BuildNumber.still_free!(latest: 12, chosen: 13)
    assert_raises(GD::Refusal) { GD::BuildNumber.still_free!(latest: 13, chosen: 13) }
  end
end

class GuardsTest < Minitest::Test
  def test_flavor_must_be_given_known_and_match_the_config
    GD.ensure_flavor!('dev', { 'EXPO_PUBLIC_ENV' => 'dev' })
    assert_raises(GD::Refusal) { GD.ensure_flavor!(nil, { 'EXPO_PUBLIC_ENV' => 'dev' }) }
    assert_raises(GD::Refusal) { GD.ensure_flavor!('', { 'EXPO_PUBLIC_ENV' => 'dev' }) }
    assert_raises(GD::Refusal) { GD.ensure_flavor!('production', { 'EXPO_PUBLIC_ENV' => 'production' }) }
    assert_raises(GD::Refusal) { GD.ensure_flavor!('stag', { 'EXPO_PUBLIC_ENV' => 'dev' }) }
  end

  def test_firebase_channel_refuses_prod_and_store_channel_takes_only_prod
    GD.ensure_channel!(:firebase, 'dev')
    GD.ensure_channel!(:firebase, 'stag')
    error = assert_raises(GD::Refusal) { GD.ensure_channel!(:firebase, 'prod') }
    assert_match(/store lanes/, error.message)
    GD.ensure_channel!(:store, 'prod')
    assert_raises(GD::Refusal) { GD.ensure_channel!(:store, 'dev') }
  end

  def test_firebase_app_id_shape_and_platform
    assert_equal '1:773600986874:ios:4335ed45aac373b081eb43',
                 GD.firebase_app_id!('1:773600986874:ios:4335ed45aac373b081eb43', 'ios')
    # The value found in SSM on the first run: the project number alone.
    assert_raises(GD::Refusal) { GD.firebase_app_id!('773600986874', 'ios') }
    assert_raises(GD::Refusal) { GD.firebase_app_id!('1:773600986874:android:4c93efc0dee1cc8781eb43', 'ios') }
    assert_raises(GD::Refusal) { GD.firebase_app_id!('', 'android') }
  end

  def test_switches_are_four_booleans
    text = "SENTRY_DISABLE_AUTO_UPLOAD=true\nSENTRY_ALLOW_FAILURE=false\n" \
           "SENTRY_DISABLE_XCODE_DEBUG_UPLOAD=false\nSENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=false\n"
    assert_equal 'true', GD.parse_switches(text)['SENTRY_DISABLE_AUTO_UPLOAD']
    assert_raises(GD::Refusal) { GD.parse_switches(text.sub('=true', '=yes')) }
    assert_raises(GD::Refusal) { GD.parse_switches("#{text}SENTRY_AUTH_TOKEN=x\n") }
  end
end

class SupervisorTest < Minitest::Test
  def setup
    @dir = Dir.mktmpdir('gogo-distribute-test')
    @supervisor = GD::Supervisor.new(run_file: File.join(@dir, 'run.json'))
  end

  def teardown
    FileUtils.rm_rf(@dir)
  end

  # F-04: stderr is kept — a warning on success, the reason on failure.
  def test_capture_keeps_stderr
    err = File.join(@dir, 'err.log')
    out = @supervisor.capture(['/bin/sh', '-c', 'echo out; echo warn >&2'], env: {}, chdir: @dir, err_log: err)
    assert_equal "out\n", out
    assert_equal "warn\n", File.read(err)
    error = assert_raises(GD::Refusal) do
      @supervisor.capture(['/bin/sh', '-c', 'echo refused-because >&2; exit 1'], env: {}, chdir: @dir, err_log: err)
    end
    assert_match(/refused-because/, error.message)
  end

  def test_child_sees_exactly_the_environment_it_was_given
    out = @supervisor.capture(['/usr/bin/env'], env: { 'PATH' => '/usr/bin:/bin', 'ONLY_THIS' => '1' }, chdir: @dir)
    names = out.lines.map { |l| l.split('=', 2).first }.sort
    # macOS may add __CF_USER_TEXT_ENCODING to every process; nothing else.
    assert_equal %w[ONLY_THIS PATH], names - ['__CF_USER_TEXT_ENCODING']
  end

  def test_failure_raises_with_the_log_path
    log = File.join(@dir, 'child.log')
    error = assert_raises(GD::Refusal) { @supervisor.run(['/bin/sh', '-c', 'echo boom; exit 3'], env: {}, chdir: @dir, log: log) }
    assert_match(/exited 3/, error.message)
    assert_equal "boom\n", File.read(log)
  end

  def test_leftover_grandchildren_are_terminated_before_run_returns
    marker = File.join(@dir, 'grandchild.pid')
    @supervisor.run(['/bin/sh', '-c', "sleep 60 & echo $! > #{marker}; exit 0"], env: {}, chdir: @dir)
    pid = File.read(marker).to_i
    sleep 0.2
    refute(alive?(pid), 'a process left in the child group survived run')
  end

  def test_terminate_all_escalates_to_kill_for_a_child_that_ignores_term
    GD::Supervisor.send(:remove_const, :TERM_GRACE)
    GD::Supervisor.const_set(:TERM_GRACE, 1)
    thread = Thread.new do
      @supervisor.run(['/bin/sh', '-c', "trap '' TERM; sleep 60"], env: {}, chdir: @dir, allow_failure: true)
    end
    sleep 0.5 until @supervisor.live_groups.any?
    @supervisor.terminate_all
    assert_empty @supervisor.live_groups
    thread.kill
  ensure
    GD::Supervisor.send(:remove_const, :TERM_GRACE)
    GD::Supervisor.const_set(:TERM_GRACE, 10)
  end

  def test_run_file_lists_live_groups_and_is_marked_finished
    thread = Thread.new { @supervisor.run(['/bin/sleep', '30'], env: {}, chdir: @dir, allow_failure: true) }
    # The child is registered just before run.json is rewritten, on the other thread.
    data = nil
    50.times do
      data = JSON.parse(File.read(File.join(@dir, 'run.json')))
      break unless data['pgids'].empty?

      sleep 0.1
    end
    assert_equal Process.pid, data['ruby_pid']
    refute_empty data['pgids']
    @supervisor.terminate_all
    thread.kill
    @supervisor.finish!
    assert JSON.parse(File.read(File.join(@dir, 'run.json')))['finished']
  end

  private

  def alive?(pid)
    Process.kill(0, pid)
    true
  rescue Errno::ESRCH
    false
  end
end

class SignalsTest < Minitest::Test
  def setup
    GD::Signals.install!(%w[HUP])
    GD::Signals.reset!
  end

  # F-03: a signal between spawn and registration waits until the child is on
  # the cleanup list, then raises.
  def test_a_signal_inside_critical_is_held_until_the_block_ends
    reached_end = false
    assert_raises(SignalException) do
      GD::Signals.critical do
        Process.kill('HUP', Process.pid)
        sleep 0.2 # the trap runs here; it must not raise yet
        reached_end = true
      end
    end
    assert reached_end, 'the signal interrupted the critical section'
    assert_nil GD::Signals.pending
  end

  def test_nested_critical_releases_a_signal_only_at_the_outermost_exit
    reached_end = false
    error = assert_raises(Interrupt) do
      GD::Signals.critical do
        GD::Signals.critical do
          GD::Signals.deliver('INT')
          GD::Signals.deliver('TERM')
        end
        assert_equal 'INT', GD::Signals.pending
        GD::Signals.critical { assert_equal 'INT', GD::Signals.pending }
        reached_end = true
      end
    end
    assert_instance_of Interrupt, error
    assert reached_end
    assert_nil GD::Signals.pending
    assert_equal :next_section, GD::Signals.critical { :next_section }
    assert_raises(Interrupt) { GD::Signals.deliver('INT') }
  end

  def test_pending_signal_takes_precedence_over_a_block_exception
    failure = IOError.new('run.json persistence failed')
    error = assert_raises(SignalException) do
      GD::Signals.critical do
        GD::Signals.critical do
          GD::Signals.deliver('TERM')
          raise failure
        end
      end
    end
    assert_equal Signal.list.fetch('TERM'), error.signo
    assert_same failure, error.cause
    assert_nil GD::Signals.pending
    assert_equal :next_section, GD::Signals.critical { :next_section }
    assert_raises(Interrupt) { GD::Signals.deliver('INT') }
  end

  def test_rescued_inner_exception_keeps_the_outer_section_critical
    reached_end = false
    assert_raises(Interrupt) do
      GD::Signals.critical do
        begin
          GD::Signals.critical { raise IOError, 'write failed' }
        rescue IOError
          GD::Signals.deliver('INT')
        end
        reached_end = true
      end
    end
    assert reached_end
    assert_nil GD::Signals.pending
  end

  def test_throw_releases_a_pending_signal_and_restores_depth
    assert_raises(Interrupt) do
      catch(:done) do
        GD::Signals.critical do
          GD::Signals.critical do
            GD::Signals.deliver('INT')
            throw :done
          end
        end
      end
    end
    assert_nil GD::Signals.pending
    assert_equal :next_section, GD::Signals.critical { :next_section }
    assert_raises(Interrupt) { GD::Signals.deliver('INT') }
  end

  def test_break_releases_a_pending_signal_and_restores_depth
    assert_raises(Interrupt) do
      GD::Signals.critical do
        GD::Signals.deliver('INT')
        break :done
      end
    end
    assert_nil GD::Signals.pending
    assert_equal :next_section, GD::Signals.critical { :next_section }
    assert_raises(Interrupt) { GD::Signals.deliver('INT') }
  end

  def test_exits_without_a_pending_signal_preserve_the_original_result
    failure = IOError.new('write failed')
    assert_same failure, assert_raises(IOError) { GD::Signals.critical { raise failure } }
    assert_equal :done, catch(:done) { GD::Signals.critical { throw :done, :done } }
    assert_equal :done, GD::Signals.critical { break :done }
    assert_equal :done, GD::Signals.critical { next :done }
    assert_raises(Interrupt) { GD::Signals.deliver('INT') }
  end

  def test_supervisor_registers_before_a_held_signal_is_raised
    Dir.mktmpdir do |dir|
      supervisor = GD::Supervisor.new(run_file: File.join(dir, 'run.json'))
      pid = nil
      assert_raises(SignalException) do
        supervisor.spawn_registered do
          pid = Process.spawn({}, '/bin/sleep', '30', unsetenv_others: true, pgroup: true)
          Process.kill('HUP', Process.pid)
          sleep 0.2
          pid
        end
      end
      assert_includes supervisor.live_groups, pid
      assert_includes JSON.parse(File.read(File.join(dir, 'run.json')))['pgids'], pid
      supervisor.terminate_all
      assert_empty supervisor.live_groups
    end
  end
end

class CleanupTest < Minitest::Test
  def test_removes_files_and_dirs_clears_secrets_and_is_idempotent
    dir = Dir.mktmpdir('gogo-cleanup-test')
    supervisor = GD::Supervisor.new(run_file: File.join(dir, 'run.json'))
    env = { 'ASC_KEY_CONTENT' => 'x', 'PATH' => '/bin' }
    secrets = GD::Secrets.capture!({ 'ANDROID_KEY_PASSWORD' => +'pw' })
    cleanup = GD::Cleanup.new(supervisor: supervisor, secrets: secrets, env: env)
    file = cleanup.file(File.join(dir, 'keystore.p12'))
    File.write(file, 'secret')
    sub = cleanup.dir(File.join(dir, 'app.xcarchive'))
    FileUtils.mkdir_p(File.join(sub, 'x'))

    cleanup.run
    cleanup.run

    refute File.exist?(file)
    refute File.exist?(sub)
    refute secrets.key?('ANDROID_KEY_PASSWORD')
    assert_equal({ 'PATH' => '/bin' }, env)
  ensure
    FileUtils.rm_rf(dir)
  end
end

# GoGo-MobileApp#413: the Size Analysis upload (shape D3, D5, D6, D7, D10).
class SentryPropertiesTest < Minitest::Test
  # What @sentry/react-native 8.30.0 writes (plugin/build/withSentry.js:99-102).
  GENERATED = <<~PROPS
    defaults.url=https://sentry.io/
    defaults.org=gogo-vn
    defaults.project=gogo-mobile
    # Using SENTRY_AUTH_TOKEN environment variable
  PROPS

  def test_reads_the_three_coordinates
    assert_equal({ 'defaults.url' => 'https://sentry.io/', 'defaults.org' => 'gogo-vn', 'defaults.project' => 'gogo-mobile' },
                 GD::SentryProperties.parse(GENERATED))
  end

  def test_refuses_a_token_kept_in_the_file_without_repeating_it
    error = assert_raises(GD::Refusal) { GD::SentryProperties.parse("#{GENERATED}auth.token=sntrys_secret\n") }
    assert_match(/auth\.token/, error.message)
    refute_match(/sntrys_secret/, error.message)
  end

  def test_refuses_an_unexpected_key_without_repeating_the_value
    error = assert_raises(GD::Refusal) { GD::SentryProperties.parse("#{GENERATED}defaults.other=hush\n") }
    assert_match(/defaults\.other/, error.message)
    refute_match(/hush/, error.message)
  end

  def test_refuses_a_missing_coordinate
    error = assert_raises(GD::Refusal) { GD::SentryProperties.parse("defaults.url=https://sentry.io/\ndefaults.org=gogo-vn\n") }
    assert_match(/defaults\.project/, error.message)
  end

  def test_refuses_a_duplicate_coordinate
    assert_raises(GD::Refusal) { GD::SentryProperties.parse("#{GENERATED}defaults.org=other\n") }
  end

  def test_refuses_a_line_that_is_not_key_value
    assert_raises(GD::Refusal) { GD::SentryProperties.parse("#{GENERATED}nonsense\n") }
  end
end

class SizeUploadTest < Minitest::Test
  PROPS = { 'defaults.url' => 'https://sentry.io/', 'defaults.org' => 'gogo-vn', 'defaults.project' => 'gogo-mobile' }.freeze

  def command(artifact: '/run/tmp/app.xcarchive')
    GD::SizeUpload.command(cli: '/x/sentry-cli', artifact: artifact, props: PROPS, sha: 'a' * 40,
                           branch: 'feature/x', notes: 'dev aaaaaaa build 7 (feature/x) host=mac')
  end

  def flag(argv, name)
    argv[argv.index(name) + 1]
  end

  def test_url_comes_before_the_subcommand_because_the_cli_rejects_it_after
    assert_equal ['/x/sentry-cli', '--url', 'https://sentry.io/', 'build', 'upload'], command.first(5)
  end

  def test_names_the_project_and_the_build_explicitly
    argv = command
    assert_equal 'gogo-vn', flag(argv, '--org')
    assert_equal 'gogo-mobile', flag(argv, '--project')
    assert_equal 'a' * 40, flag(argv, '--head-sha')
    assert_equal 'feature/x', flag(argv, '--head-ref')
    assert_equal 'namnh92/GoGo-MobileApp', flag(argv, '--head-repo-name')
    assert_equal 'github', flag(argv, '--vcs-provider')
    assert_equal 'Release', flag(argv, '--build-configuration')
    assert_equal 'dev aaaaaaa build 7 (feature/x) host=mac', flag(argv, '--release-notes')
  end

  def test_the_artifact_is_the_last_argument
    assert_equal '/run/tmp/app.xcarchive', command.last
    assert_equal '/b/gogo-dev-7.apk', command(artifact: '/b/gogo-dev-7.apk').last
  end

  def test_the_token_is_never_on_the_argument_list
    refute_includes command, '--auth-token'
    refute(command.any? { |a| a.include?('sntrys_') })
  end

  def test_build_distribution_stays_unrequested
    refute_includes command, '--install-group'
  end

  def test_skips_only_in_the_no_token_state
    assert GD::SizeUpload.skip?('SENTRY_DISABLE_AUTO_UPLOAD' => 'true')
    refute GD::SizeUpload.skip?('SENTRY_DISABLE_AUTO_UPLOAD' => 'false')
  end

  def test_a_missing_switch_does_not_read_as_skip
    refute GD::SizeUpload.skip?({})
  end

  def test_finds_the_build_link_in_the_cli_output
    out = "Successfully uploaded 1 file to Sentry\n  - /a/gogo-dev-7.apk (https://sentry.io/organizations/gogo-vn/preprod/1)\n"
    assert_equal ['https://sentry.io/organizations/gogo-vn/preprod/1'], GD::SizeUpload.links(out)
  end
end

class SizeUploadEnvTest < Minitest::Test
  def secrets
    GD::Secrets.new('SENTRY_AUTH_TOKEN' => 'sntrys_x', 'ANDROID_KEYSTORE_PASSWORD' => 'k', 'FIREBASE_SERVICE_CREDENTIALS_JSON' => '{}')
  end

  def test_the_child_gets_the_base_and_the_token_and_no_other_secret
    env = GD::EnvSets.size_upload(secrets, { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'false' }, base: { 'PATH' => '/bin' })
    assert_equal({ 'PATH' => '/bin', 'SENTRY_AUTH_TOKEN' => 'sntrys_x' }, env)
  end

  def test_no_token_in_the_no_token_state
    env = GD::EnvSets.size_upload(secrets, { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'true' }, base: { 'PATH' => '/bin' })
    assert_equal({ 'PATH' => '/bin' }, env)
  end

  def test_refuses_when_the_upload_state_has_no_token
    assert_raises(GD::Refusal) do
      GD::EnvSets.size_upload(GD::Secrets.new({}), { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'false' }, base: {})
    end
  end
end

# F-01: the step the lanes run, through a fake sentry-cli that records what it got.
class SizeUploadRunTest < Minitest::Test
  TOKEN = 'sntrys_sentinel'
  BASE = { 'PATH' => ENV.fetch('PATH') }.freeze
  # What sh itself adds to its environment.
  SHELL_VARS = %w[PWD OLDPWD SHLVL _].freeze

  def with_cli(exit_code: 0, output: '')
    Dir.mktmpdir do |dir|
      cli = File.join(dir, 'fake-cli')
      File.write(cli, <<~SH, perm: 0o700)
        #!/bin/sh
        printf '%s\\n' "$@" > "#{dir}/argv"
        env > "#{dir}/env"
        printf '%s\\n' '#{output}'
        exit #{exit_code}
      SH
      @dir = dir
      yield cli
    end
  end

  def run_step(cli, artifact: '/b/gogo-dev-7.apk', switches: { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'false' }, size: :default)
    size = { cli: cli, props: SizeUploadTest::PROPS } if size == :default
    secrets = GD::Secrets.new('SENTRY_AUTH_TOKEN' => TOKEN, 'ANDROID_KEYSTORE_PASSWORD' => 'k', 'FIREBASE_SERVICE_CREDENTIALS_JSON' => '{}')
    GD::SizeUpload.run(supervisor: GD::Supervisor.new(run_file: File.join(@dir, 'run.json')), size: size, switches: switches,
                       secrets: secrets, base: BASE, artifact: artifact, build_number: 7, sha: 'a' * 40, branch: 'b',
                       notes: 'n', log: File.join(@dir, 'size.log'), chdir: @dir)
  end

  def test_the_child_gets_the_artifact_and_the_token_only_through_its_environment
    with_cli do |cli|
      run_step(cli, artifact: '/run/tmp/app.xcarchive')
      argv = File.read(File.join(@dir, 'argv'))
      assert_equal '/run/tmp/app.xcarchive', argv.lines.last.chomp
      refute_includes argv, TOKEN
      keys = File.readlines(File.join(@dir, 'env'), chomp: true).map { |l| l.split('=', 2).first }
      assert_equal %w[PATH SENTRY_AUTH_TOKEN], (keys - SHELL_VARS).sort
      assert_includes File.read(File.join(@dir, 'env')), "SENTRY_AUTH_TOKEN=#{TOKEN}"
    end
  end

  def test_returns_the_links_the_cli_printed
    with_cli(output: 'uploaded (https://sentry.io/x/1)') do |cli|
      assert_equal ['https://sentry.io/x/1'], run_step(cli)
    end
  end

  def test_a_failed_upload_raises_and_says_the_build_is_already_out
    with_cli(exit_code: 1, output: 'quota') do |cli|
      error = assert_raises(GD::Refusal) { run_step(cli) }
      assert_match(/size analysis upload failed or was not confirmed after Firebase distributed build 7/, error.message)
      assert_match(/look for this build in Sentry/, error.message)
      assert_match(/with the testers/, error.message)
      assert_includes File.read(File.join(@dir, 'size.log')), 'quota'
    end
  end

  def test_a_log_that_cannot_be_read_does_not_undo_a_successful_upload
    with_cli do |cli|
      File.stub(:read, ->(*) { raise Errno::EIO }) { assert_equal [], run_step(cli) }
    end
  end

  def test_the_no_token_state_starts_no_child
    with_cli do |cli|
      assert_nil run_step(cli, switches: { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'true' }, size: nil)
      refute File.exist?(File.join(@dir, 'argv'))
    end
  end

  def test_a_token_state_without_a_prepared_upload_refuses
    with_cli do |cli|
      assert_raises(GD::Refusal) { run_step(cli, size: nil) }
    end
  end
end

class PublishOrderTest < Minitest::Test
  def test_firebase_comes_first
    calls = []
    GD::SizeUpload.publish(distribute: -> { calls << :firebase }, measure: -> { calls << :size })
    assert_equal %i[firebase size], calls
  end

  def test_a_firebase_failure_means_no_size_upload
    measured = false
    assert_raises(GD::Refusal) do
      GD::SizeUpload.publish(distribute: -> { raise GD::Refusal, 'firebase' }, measure: -> { measured = true })
    end
    refute measured
  end

  def test_a_size_failure_escapes
    assert_raises(GD::Refusal) do
      GD::SizeUpload.publish(distribute: -> {}, measure: -> { raise GD::Refusal, 'size' })
    end
  end
end

# F-01: the step methods of the real Fastfile, run through fastfile_harness.rb with
# a fake sentry-cli and recording Firebase actions.
require_relative 'fastfile_harness'

class FastfileStepsTest < Minitest::Test
  APP_ID = '1:123456789012:android:0123456789abcdef'

  def setup
    FastfileHarness.reset!
    @dir = Dir.mktmpdir
    @supervisor = GD::Supervisor.new(run_file: File.join(@dir, 'run.json'))
    @cleanup = GD::Cleanup.new(supervisor: @supervisor, secrets: nil, env: {})
    @ctx = { env: 'dev', platform: 'android', sha: 'c' * 40, branch: 'feature/x', groups: 'dev-testers',
             bundle_id: 'max.gogo.dev', log_dir: @dir, supervisor: @supervisor, cleanup: @cleanup,
             base: { 'PATH' => ENV.fetch('PATH') } }
    @switches = { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'false' }
  end

  def teardown
    FileUtils.rm_rf(@dir)
  end

  def fake_cli(exit_code: 0)
    cli = File.join(@dir, 'fake-cli')
    File.write(cli, <<~SH, perm: 0o700)
      #!/bin/sh
      printf '%s\\n' "$@" > "#{@dir}/argv"
      env > "#{@dir}/env"
      echo size >> "#{@dir}/order"
      echo 'uploaded (https://sentry.io/harness/1)'
      exit #{exit_code}
    SH
    { cli: cli, props: SizeUploadTest::PROPS }
  end

  def order
    firebase = FastfileHarness::Firebase.order
    size = File.exist?(File.join(@dir, 'order')) ? [:size] : []
    firebase + size
  end

  def test_publish_sends_the_build_to_firebase_first_then_to_sentry
    gogo_publish(@ctx, APP_ID, 7, @switches, fake_cli, firebase_artifact: '/b/gogo-dev-7.apk', size_artifact: '/b/gogo-dev-7.apk')
    assert_equal %i[firebase size], order
    assert_equal '/b/gogo-dev-7.apk', FastfileHarness::Firebase.calls.first[:apk_path]
    assert_equal '/b/gogo-dev-7.apk', File.readlines(File.join(@dir, 'argv'), chomp: true).last
    assert_includes UI.lines, [:message, 'distribute: size analysis: uploaded gogo-dev-7.apk build=7 links=https://sentry.io/harness/1']
  end

  def test_ios_routes_the_ipa_to_firebase_and_the_xcarchive_to_sentry
    @ctx[:platform] = 'ios'
    gogo_publish(@ctx, APP_ID, 7, @switches, fake_cli, firebase_artifact: '/out/app.ipa', size_artifact: '/run/tmp/app.xcarchive')
    assert_equal '/out/app.ipa', FastfileHarness::Firebase.calls.first[:ipa_path]
    assert_equal '/run/tmp/app.xcarchive', File.readlines(File.join(@dir, 'argv'), chomp: true).last
  end

  def test_the_child_sees_the_token_in_its_environment_and_nowhere_else
    gogo_publish(@ctx, APP_ID, 7, @switches, fake_cli, firebase_artifact: '/b/a.apk', size_artifact: '/b/a.apk')
    assert_includes File.read(File.join(@dir, 'env')), 'SENTRY_AUTH_TOKEN=sntrys_harness_sentinel'
    refute_includes File.read(File.join(@dir, 'argv')), 'sntrys_'
    refute(UI.lines.any? { |_, text| text.include?('sntrys_') })
    refute_includes File.read(File.join(@dir, 'env')), 'FIREBASE_SERVICE_CREDENTIALS_JSON'
  end

  def test_a_failed_size_upload_escapes_after_firebase_with_the_build_already_out
    error = assert_raises(FastfileHarness::UserError) do
      gogo_publish(@ctx, APP_ID, 7, @switches, fake_cli(exit_code: 1), firebase_artifact: '/b/a.apk', size_artifact: '/b/a.apk')
    end
    assert_equal %i[firebase size], order
    assert_match(/size analysis upload failed or was not confirmed after Firebase distributed build 7/, error.message)
    assert(UI.lines.any? { |kind, text| kind == :error && text.include?('uploaded (https://sentry.io/harness/1)') }, 'log tail shown')
  end

  def test_a_firebase_failure_stops_before_any_size_upload
    FastfileHarness::Firebase.fail_upload = true
    assert_raises(FastfileHarness::UserError) do
      gogo_publish(@ctx, APP_ID, 7, @switches, fake_cli, firebase_artifact: '/b/a.apk', size_artifact: '/b/a.apk')
    end
    assert_equal [], order
    refute File.exist?(File.join(@dir, 'argv'))
  end

  def test_a_build_number_firebase_took_meanwhile_stops_before_both_uploads
    FastfileHarness::Firebase.latest = 7
    assert_raises(FastfileHarness::UserError) do
      gogo_publish(@ctx, APP_ID, 7, @switches, fake_cli, firebase_artifact: '/b/a.apk', size_artifact: '/b/a.apk')
    end
    assert_empty FastfileHarness::Firebase.calls
    assert_equal [], order
  end

  def test_the_no_token_state_distributes_and_starts_no_sentry_child
    gogo_publish(@ctx, APP_ID, 7, { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'true' }, nil, firebase_artifact: '/b/a.apk', size_artifact: '/b/a.apk')
    assert_equal [:firebase], order
    refute(UI.lines.any? { |_, text| text.include?('size analysis: uploaded') })
  end

  def test_the_token_state_without_a_prepared_upload_fails_the_run
    error = assert_raises(FastfileHarness::UserError) do
      gogo_publish(@ctx, APP_ID, 7, @switches, nil, firebase_artifact: '/b/a.apk', size_artifact: '/b/a.apk')
    end
    assert_match(/not prepared before the build/, error.message)
  end

  def test_prepare_in_the_no_token_state_warns_once_and_returns_nil
    assert_nil gogo_size_prepare(@ctx, { 'SENTRY_DISABLE_AUTO_UPLOAD' => 'true' })
    assert_equal [[:important, 'no SENTRY_AUTH_TOKEN: this build is not measured in Size Analysis either']], UI.lines
  end
end

# The Fastfile needs fastlane to load, so its wiring is pinned from the source.
class FastfileWiringTest < Minitest::Test
  SOURCE = File.read(File.expand_path('../Fastfile', __dir__))

  def lane(platform)
    SOURCE[/^platform :#{platform} do.*?^end$/m]
  end

  def test_ios_sends_the_ipa_to_firebase_and_the_xcarchive_to_sentry
    assert_match(/gogo_publish\(.*firebase_artifact: ipa, size_artifact: archive\)/, lane('ios'))
  end

  def test_android_sends_the_apk_to_both
    assert_match(/gogo_publish\(.*firebase_artifact: apk, size_artifact: apk\)/, lane('android'))
  end

  def test_no_lane_reaches_firebase_except_through_publish
    %w[ios android].each do |platform|
      refute_match(/gogo_upload\(/, lane(platform))
      refute_match(/gogo_size_upload\(/, lane(platform))
    end
  end

  def test_both_lanes_check_the_upload_setup_before_the_native_build
    assert_operator lane('ios').index('gogo_size_prepare'), :<, lane('ios').index("'xcodebuild-archive'")
    assert_operator lane('android').index('gogo_size_prepare'), :<, lane('android').index("'gradle-assemble'")
  end

  def test_the_step_cannot_be_told_to_tolerate_failure
    refute_match(/allow_failure/, SOURCE)
    refute_match(/allow_failure/, File.read(File.expand_path('../lib/gogo_distribute.rb', __dir__))[/module SizeUpload.*?^  end$/m])
  end
end
