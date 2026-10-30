# fastlane runs the Firebase App Distribution lanes (GoGo-MobileApp#391) and,
# later, the store lanes (#350/#351). Always `bundle exec fastlane`; the
# lockfile is the version pin. Ruby comes from .ruby-version (mise, under $HOME).
source 'https://rubygems.org'

ruby '>= 3.2'

gem 'fastlane'

plugins_path = File.join(__dir__, 'fastlane', 'Pluginfile')
eval_gemfile(plugins_path) if File.exist?(plugins_path)

group :test do
  gem 'minitest'
end
