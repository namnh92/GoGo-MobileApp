# frozen_string_literal: true

# Entry point of the Firebase lanes (GoGo-MobileApp#391), exec'd by
# scripts/lib/distribute-run.sh with the secrets exec-with.sh fetched.
#
# fastlane's own startup runs before any Fastfile line — and shells out (it
# asks `locale` for the charmap when LANG/LC_ALL do not say UTF-8). So the
# secrets leave ENV here, before fastlane is loaded at all, and the signal
# handling that guards child registration is in place before anything can
# spawn. The Fastfile picks the captured set up from GOGO_BOOT_SECRETS.

require_relative 'lib/gogo_distribute'

GOGO_BOOT_SECRETS = GogoDistribute::Secrets.capture!(ENV)
GogoDistribute::Signals.install!

load Gem.bin_path('fastlane', 'fastlane')
