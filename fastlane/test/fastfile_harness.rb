# frozen_string_literal: true

# Loads the real Fastfile without fastlane, so its step methods run under test
# (GoGo-MobileApp#413, Sol F-01). The lane DSL words become no-ops that keep the
# lane bodies unexecuted; the fastlane actions the steps call become recorders
# the tests read; UI raises on user_error! like fastlane's does.
#
#   require_relative 'fastfile_harness'   # then call gogo_publish, gogo_size_upload …

require 'gogo_distribute'

module FastfileHarness
  class UserError < StandardError; end

  # Fastlane's UI, reduced to what the steps use.
  module UI
    class << self
      attr_reader :lines

      def reset!
        @lines = []
      end

      def message(text)   = (@lines << [:message, text])
      def important(text) = (@lines << [:important, text])
      def error(text)     = (@lines << [:error, text])

      def user_error!(text)
        @lines << [:user_error, text]
        raise UserError, text
      end
    end
  end

  # The two Firebase actions `gogo_upload` calls, as recorders.
  module Firebase
    class << self
      attr_accessor :latest, :fail_upload, :calls, :order

      def reset!
        @latest = 0
        @fail_upload = false
        @calls = []
        @order = []
      end
    end
  end

  def self.reset!
    UI.reset!
    Firebase.reset!
  end
end

# Lane DSL: define, never run.
def skip_docs; end
def default_platform(_name); end
def platform(_name) = yield
def desc(_text); end
def lane(_name, &_block); end
def private_lane(_name, &_block); end

def firebase_app_distribution_get_latest_release(**)
  { buildVersion: FastfileHarness::Firebase.latest.to_s }
end

def firebase_app_distribution(**args)
  FastfileHarness::Firebase.calls << args
  raise GogoDistribute::Refusal, 'firebase upload refused (harness)' if FastfileHarness::Firebase.fail_upload

  FastfileHarness::Firebase.order << :firebase
  { firebaseConsoleUri: 'https://console.firebase.google.com/harness' }
end

UI = FastfileHarness::UI

# The Fastfile captures its secrets from ENV at load. These are the harness's.
ENV['SENTRY_AUTH_TOKEN'] = 'sntrys_harness_sentinel'
ENV['FIREBASE_SERVICE_CREDENTIALS_JSON'] = '{"harness":true}'
FastfileHarness.reset!
load File.expand_path('../Fastfile', __dir__)
raise 'the Fastfile left a secret in ENV' if ENV.key?('SENTRY_AUTH_TOKEN') || ENV.key?('FIREBASE_SERVICE_CREDENTIALS_JSON')
