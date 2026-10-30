# frozen_string_literal: true

# bundle exec ruby -Ifastlane/lib fastlane/test/gogo_distribute_test.rb
# GoGo-MobileApp#391 — the parts of the Firebase lanes that hold secrets or
# decide what ships, tested without fastlane, AWS or a build.

require 'minitest/autorun'
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
    # mobile-env.py + tenjin-mobile-env.py (GoGo-Infra); a new key there must be
    # added here on purpose, not slip through.
    assert_equal 13, GD::APP_CONFIG_KEYS.size
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
      'GOOGLE_MAPS_IOS_API_KEY' => 'mi', 'GOOGLE_MAPS_ANDROID_API_KEY' => 'ma', 'APPLE_TEAM_ID' => 'ABCDE12345',
      'ASC_KEY_CONTENT' => 'pem', 'ANDROID_KEYSTORE_PASSWORD' => 'pw', 'FIREBASE_SERVICE_CREDENTIALS_JSON' => '{}',
      'SENTRY_AUTH_TOKEN' => 'tok'
    })
  end

  def test_base_carries_only_the_named_variables
    base = GD::EnvSets.base({ 'PATH' => '/bin', 'HOME' => '/h', 'ASC_KEY_CONTENT' => 'x', 'RUBYOPT' => '-rbundler/setup',
                              'BUNDLE_GEMFILE' => '/g' })
    assert_equal({ 'PATH' => '/bin', 'HOME' => '/h', 'EXPO_NO_TELEMETRY' => '1' }, base)
  end

  def test_app_config_adds_maps_team_build_and_sha_and_nothing_secret
    cfg = GD::EnvSets.app_config({ 'EXPO_PUBLIC_ENV' => 'dev' }, secrets: secrets, build_number: 7,
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
    sleep 0.2 until @supervisor.live_groups.any?
    data = JSON.parse(File.read(File.join(@dir, 'run.json')))
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
