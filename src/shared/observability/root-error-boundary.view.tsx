import * as SplashScreen from 'expo-splash-screen'
import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { View } from 'react-native'

import { ErrorState } from '@/shared/ui/async-state.view'

import { styles } from './root-error-boundary.style'
import { captureError } from './sentry'

interface Props {
  children: ReactNode
}

interface State {
  error: unknown
  /** Bumped by retry so the subtree mounts fresh instead of re-rendering the broken one. */
  attempt: number
}

/**
 * GoGo-MobileApp#336 — the app had no root error boundary, so a render error
 * left a blank screen and nobody heard about it. This one reports it
 * (`kind: 'boundary'`) and renders the generic error state.
 *
 * It sits *outside* `AppProviders`, so it may use nothing they provide (query
 * client, session, safe area). `ErrorState` needs only i18n and the theme,
 * both configured before any route renders. It also lifts the native splash:
 * only `AppProviders` does that, and a crash before it got there would
 * otherwise hold the splash forever.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error('render error') }
  }

  componentDidCatch(error: unknown, _info: ErrorInfo): void {
    captureError(error, { kind: 'boundary' })
    void SplashScreen.hideAsync().catch(() => {})
  }

  private retry = () => {
    this.setState(state => ({ error: null, attempt: state.attempt + 1 }))
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.fallback} testID="root-error-boundary">
          <ErrorState error={this.state.error} onRetry={this.retry} />
        </View>
      )
    }
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}
