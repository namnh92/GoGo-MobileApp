import { StyleSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
StyleSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
const { submissionDetailCases } = jest.requireActual<typeof import('./submission-detail.cases')>('./submission-detail.cases')
submissionDetailCases(true)
