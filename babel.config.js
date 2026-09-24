module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Unistyles rewrites `StyleSheet.create(theme => …)` call sites under
      // `src/` so a theme change restyles them without a React re-render.
      // Plugins run before presets, so this sees the source before
      // babel-preset-expo's worklets transform does.
      ['react-native-unistyles/plugin', { root: 'src' }],
    ],
  }
}
