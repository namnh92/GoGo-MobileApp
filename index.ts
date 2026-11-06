// Install the fixed typography policy before Router or third-party UI loads.
import './src/shared/ui/font-scaling'

// App entry. Unistyles must be configured before any route module evaluates a
// `StyleSheet.create`; Expo Router loads routes lazily, after both imports
// below have run, which is the order its Unistyles guide prescribes.
import 'expo-router/entry'
import './src/shared/ui/unistyles'
