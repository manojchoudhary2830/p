import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ errorInfo: info });
    // In production, send to crash reporting (e.g. Sentry)
    if (__DEV__) {
      console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred. Please try again.
            </Text>
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.debugBox}>
                <Text style={styles.debugText}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Text>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', width: '100%', maxWidth: 360,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  icon:     { fontSize: 48, marginBottom: 16 },
  title:    { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  debugBox: {
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12,
    maxHeight: 150, width: '100%', marginBottom: 16,
  },
  debugText:   { fontSize: 11, color: '#DC2626', fontFamily: 'monospace' },
  button:      { backgroundColor: '#1E3A8A', borderRadius: 12, height: 48, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  buttonText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
});
