import { StyleSheet } from 'react-native'

import { colors, radius, spacing, status, type } from '@/shared/ui/tokens'

const { neutral } = colors

// A warning notice on a solid white surface, outlined in the warning label
// colour. The surface is white, not `warningSoft`, because the Ghost action
// inside it is an accent-coloured 13pt label: accent primary clears AA 4.5:1
// on white under every theme, and only 4.29–4.37:1 on `amberSoft` (#317 F-02).
// The copy carries the meaning, not the colour.
export const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
    padding: spacing[4],
    marginBottom: spacing[4],
    borderRadius: radius.compact,
    borderWidth: 1,
    borderColor: status.warningText,
    backgroundColor: neutral[0],
  },
  body: { ...type.bodySmall, color: neutral[900] },
})
