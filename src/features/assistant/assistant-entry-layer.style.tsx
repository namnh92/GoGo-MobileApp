import { StyleSheet } from 'react-native-unistyles'

import { fill } from '@/shared/ui/tokens'

/** Covers the tabs (tab bar included) but passes touches through except where it draws. */
export const styles = StyleSheet.create(() => ({
  layer: { ...fill },
}))
