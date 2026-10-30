# frozen_string_literal: true

# Plain-Ruby parts of the Firebase distribution lanes (GoGo-MobileApp#391),
# kept out of the Fastfile so they load and test without fastlane.
# Shape: dev/handoffs/sa-shape-mobile-391-firebase-lane.fable.md (GoGo
# workspace); the D-numbers below point there.

require 'json'
require 'fileutils'
require 'securerandom'

module GogoDistribute
  class Refusal < StandardError; end

  FLAVORS = %w[dev stag prod].freeze
  CHANNELS = { firebase: %w[dev stag], store: %w[prod] }.freeze

  # Every variable exec-with.sh can hand the lane, plus the public inputs the
  # wrapper exports. Captured into memory and deleted from ENV before anything
  # can spawn (D-17).
  SECRET_KEYS = %w[
    ASC_KEY_CONTENT ASC_KEY_ID ASC_ISSUER_ID
    ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD
    FIREBASE_SERVICE_CREDENTIALS_JSON SENTRY_AUTH_TOKEN
    GOOGLE_MAPS_IOS_API_KEY GOOGLE_MAPS_ANDROID_API_KEY APPLE_TEAM_ID
    FIREBASE_APP_ID_IOS FIREBASE_APP_ID_ANDROID
  ].freeze

  # Exactly what GoGo-Infra's mobile-env.py and tenjin-mobile-env.py emit (D-8).
  APP_CONFIG_KEYS = %w[
    EXPO_PUBLIC_ENV EXPO_PUBLIC_API_URL EXPO_PUBLIC_WEB_BASE_URL
    ONESIGNAL_APP_ID ONESIGNAL_CONFIG_ENV ONESIGNAL_APNS_MODE EXPO_PUBLIC_SENTRY_DSN
    ADJUST_IOS_APP_TOKEN ADJUST_ANDROID_APP_TOKEN ADJUST_CONFIG_ENV
    TENJIN_IOS_SDK_KEY TENJIN_ANDROID_SDK_KEY TENJIN_CONFIG_ENV
  ].freeze

  SENTRY_SWITCHES = %w[
    SENTRY_DISABLE_AUTO_UPLOAD SENTRY_ALLOW_FAILURE
    SENTRY_DISABLE_XCODE_DEBUG_UPLOAD SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD
  ].freeze

  # The only variables a child inherits from this process (D-17 BASE).
  BASE_KEYS = %w[PATH HOME TMPDIR LANG LC_ALL SHELL USER CI LOGNAME DEVELOPER_DIR JAVA_HOME ANDROID_HOME ANDROID_SDK_ROOT].freeze

  # D-8: KEY=value lines, data only. No interpolation, no unquoting, no eval —
  # mobile-env.py writes values unquoted and its URL check admits `;` and `&`.
  module EnvFile
    LINE = /\A([A-Z][A-Z0-9_]*)=(.*)\z/

    def self.parse(text, allowlist:, required: allowlist)
      values = {}
      text.each_line(chomp: true).with_index(1) do |line, number|
        next if line.strip.empty? || line.lstrip.start_with?('#')

        match = LINE.match(line) or raise Refusal, "env file line #{number}: not KEY=value"
        key, value = match[1], match[2]
        raise Refusal, "env file line #{number}: #{key} is not an expected key" unless allowlist.include?(key)
        raise Refusal, "env file line #{number}: #{key} appears twice" if values.key?(key)
        if value.start_with?('"', "'") || value.include?("\r")
          raise Refusal, "env file line #{number}: #{key} is quoted or multi-line; values are literal"
        end

        values[key] = value
      end
      missing = required - values.keys
      raise Refusal, "env file is missing #{missing.join(', ')}" unless missing.empty?

      values.freeze
    end
  end

  # D-17: the process's secrets, held in memory only.
  class Secrets
    def self.capture!(env)
      captured = SECRET_KEYS.each_with_object({}) do |key, out|
        value = env.delete(key)
        out[key] = value unless value.nil?
      end
      new(captured)
    end

    def initialize(values)
      @values = values
    end

    def [](key)
      @values[key]
    end

    def fetch(key)
      value = @values[key]
      raise Refusal, "#{key} was not provided by exec-with.sh" if value.nil? || value.empty?

      value
    end

    def key?(key)
      @values.key?(key) && !@values[key].to_s.empty?
    end

    def clear!
      @values.each_value { |v| v.replace('') if v.is_a?(String) && !v.frozen? }
      @values.clear
    end
  end

  # D-17: the environment of each child, composed from named sets.
  module EnvSets
    def self.base(env = ENV)
      BASE_KEYS.each_with_object({}) { |k, out| out[k] = env[k] if env[k] }
               .merge('EXPO_NO_TELEMETRY' => '1')
    end

    def self.app_config(parsed, secrets:, build_number:, sha:, platform:)
      cfg = parsed.dup
      cfg['GOOGLE_MAPS_IOS_API_KEY'] = secrets.fetch('GOOGLE_MAPS_IOS_API_KEY')
      cfg['GOOGLE_MAPS_ANDROID_API_KEY'] = secrets.fetch('GOOGLE_MAPS_ANDROID_API_KEY')
      cfg['APPLE_TEAM_ID'] = secrets.fetch('APPLE_TEAM_ID')
      cfg[platform == 'ios' ? 'IOS_BUILD_NUMBER' : 'ANDROID_VERSION_CODE'] = build_number.to_s
      cfg['GOGO_BUILD_SHA'] = sha
      cfg
    end

    def self.sentry(secrets, switches)
      out = switches.dup
      out['SENTRY_AUTH_TOKEN'] = secrets['SENTRY_AUTH_TOKEN'] if secrets.key?('SENTRY_AUTH_TOKEN')
      out
    end
  end

  # D-10: Firebase is the counter; the lane refuses a number that is not above it.
  module BuildNumber
    def self.resolve(latest:, requested: nil)
      floor = latest.to_i
      return floor + 1 if requested.nil? || requested.to_s.empty?

      n = Integer(requested, 10)
      raise Refusal, "build number #{n} is not above Firebase's latest (#{floor})" unless n > floor

      n
    end

    def self.still_free!(latest:, chosen:)
      return if latest.to_i < chosen

      raise Refusal, "Firebase's latest build is now #{latest} — #{chosen} would duplicate it; re-run"
    end
  end

  # D-17/D-18: every child runs in its own process group, with an explicit
  # environment, and is not considered gone until the group is empty.
  class Supervisor
    TERM_GRACE = 10 # seconds; chosen in the shape, not a sourced number
    KILL_GRACE = 5

    attr_reader :run_file

    def initialize(run_file:, clock: Process, killer: Process)
      @run_file = run_file
      @children = {} # pid => pgid
      @clock = clock
      @killer = killer
      @temp_paths = []
      write_run_file
    end

    def track_path(path)
      @temp_paths << path
      write_run_file
    end

    # Runs cmd to completion; returns the exit status. Output goes to `log`
    # (a path) when given. Raises Refusal on a non-zero exit unless allow_failure.
    def run(cmd, env:, chdir:, log: nil, allow_failure: false)
      opts = { unsetenv_others: true, pgroup: true, chdir: chdir }
      if log
        opts[[:out, :err]] = [log, 'a', 0o600]
      end
      pid = Process.spawn(env, *cmd, **opts)
      @children[pid] = pid
      write_run_file
      _, status = Process.wait2(pid)
      ensure_group_gone(pid)
      @children.delete(pid)
      write_run_file
      return status if allow_failure || status.success?

      raise Refusal, "#{File.basename(cmd.first)} exited #{status.exitstatus || status.termsig} (log: #{log || 'stdout'})"
    end

    # Captures stdout (small outputs: security, git). stderr to the log or /dev/null.
    def capture(cmd, env:, chdir:)
      reader, writer = IO.pipe
      pid = Process.spawn(env, *cmd, unsetenv_others: true, pgroup: true, chdir: chdir, out: writer, err: File::NULL)
      writer.close
      @children[pid] = pid
      write_run_file
      out = reader.read
      reader.close
      _, status = Process.wait2(pid)
      ensure_group_gone(pid)
      @children.delete(pid)
      write_run_file
      raise Refusal, "#{File.basename(cmd.first)} exited #{status.exitstatus}" unless status.success?

      out
    end

    def live_groups
      @children.values.select { |pgid| group_alive?(pgid) }
    end

    # TERM, wait, KILL, wait — verified. Raises if a group outlives KILL.
    def terminate_all
      @children.each_value { |pgid| signal_group('TERM', pgid) }
      wait_groups(TERM_GRACE)
      remaining = live_groups
      remaining.each { |pgid| signal_group('KILL', pgid) }
      wait_groups(KILL_GRACE)
      stuck = live_groups
      raise Refusal, "process groups #{stuck.join(', ')} survived SIGKILL; files and lock left in place" unless stuck.empty?

      @children.each_key { |pid| reap(pid) }
      @children.clear
      write_run_file
    end

    def finish!
      write_run_file(finished: true)
    end

    private

    def ensure_group_gone(pgid)
      # A child may leave its own children behind in the group (xcodebuild,
      # gradle workers). They get the same treatment as on an interrupt.
      return unless group_alive?(pgid)

      signal_group('TERM', pgid)
      deadline = now + TERM_GRACE
      sleep 0.2 while group_alive?(pgid) && now < deadline
      signal_group('KILL', pgid) if group_alive?(pgid)
      deadline = now + KILL_GRACE
      sleep 0.2 while group_alive?(pgid) && now < deadline
      raise Refusal, "process group #{pgid} survived SIGKILL" if group_alive?(pgid)
    end

    def wait_groups(seconds)
      deadline = now + seconds
      until live_groups.empty? || now >= deadline
        @children.each_key { |pid| reap(pid, nohang: true) }
        sleep 0.2
      end
    end

    def reap(pid, nohang: false)
      Process.waitpid(pid, nohang ? Process::WNOHANG : 0)
    rescue Errno::ECHILD
      nil
    end

    def signal_group(sig, pgid)
      @killer.kill(sig, -pgid)
    rescue Errno::ESRCH, Errno::EPERM
      nil
    end

    def group_alive?(pgid)
      @killer.kill(0, -pgid)
      true
    rescue Errno::ESRCH
      false
    rescue Errno::EPERM
      true
    end

    def now
      @clock.clock_gettime(Process::CLOCK_MONOTONIC)
    end

    def write_run_file(finished: false)
      return unless @run_file

      data = {
        'ruby_pid' => Process.pid,
        'ruby_start' => process_start(Process.pid),
        'pgids' => @children.values,
        'temp_paths' => @temp_paths,
        'finished' => finished
      }
      tmp = "#{@run_file}.tmp"
      File.write(tmp, JSON.generate(data), perm: 0o600)
      File.rename(tmp, @run_file)
    end

    def process_start(pid)
      @process_start ||= IO.popen(['ps', '-o', 'lstart=', '-p', pid.to_s], err: File::NULL, unsetenv_others: true, &:read).to_s.split.join(' ')
    end
  end

  # D-18: one owner of cleanup per process; every step is idempotent.
  class Cleanup
    def initialize(supervisor:, secrets:, env: ENV)
      @supervisor = supervisor
      @secrets = secrets
      @env = env
      @files = []
      @dirs = []
      @done = false
    end

    def file(path)
      @files << path
      @supervisor&.track_path(path)
      path
    end

    def dir(path)
      @dirs << path
      @supervisor&.track_path(path)
      path
    end

    def run
      return if @done

      # Children first: nothing is deleted while a build may still read it.
      @supervisor&.terminate_all
      @files.each { |f| remove_file(f) }
      @dirs.reverse_each { |d| FileUtils.rm_rf(d) }
      @secrets&.clear!
      SECRET_KEYS.each { |k| @env.delete(k) }
      @supervisor&.finish!
      @done = true
    end

    private

    def remove_file(path)
      return unless File.file?(path)

      # An overwrite request; APFS may not honour it (copy-on-write). The
      # deletion is the control.
      size = File.size(path)
      File.open(path, 'r+b') { |io| io.write("\0" * size) } if size.positive?
      File.delete(path)
    rescue Errno::ENOENT
      nil
    end
  end

  def self.ensure_flavor!(env, parsed)
    raise Refusal, 'env: is required (dev or stag); refusing to build a default flavour' if env.nil? || env.empty?
    raise Refusal, "env: #{env} is not one of #{FLAVORS.join(', ')}" unless FLAVORS.include?(env)
    unless parsed['EXPO_PUBLIC_ENV'] == env
      raise Refusal, "env: #{env} but the app config says EXPO_PUBLIC_ENV=#{parsed['EXPO_PUBLIC_ENV']}"
    end
  end

  def self.ensure_channel!(channel, env)
    allowed = CHANNELS.fetch(channel)
    return if allowed.include?(env)

    raise Refusal, (channel == :firebase ? 'prod ships through the store lanes (GoGo-MobileApp#350/#351), never through Firebase' : "the store lanes ship prod only, not #{env}")
  end

  # The four switch lines printed by the shared Sentry check (D-11).
  def self.parse_switches(text)
    values = EnvFile.parse(text, allowlist: SENTRY_SWITCHES)
    values.each do |k, v|
      raise Refusal, "#{k} must be true or false, got #{v}" unless %w[true false].include?(v)
    end
    values
  end
end
