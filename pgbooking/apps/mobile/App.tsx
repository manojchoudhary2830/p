import React from 'react';
import { StatusBar } from 'react-native';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { ToastProvider } from './src/components/feedback/Toast';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import RootNavigator from './src/navigation';

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </Provider>
    </ErrorBoundary>
  );
}
