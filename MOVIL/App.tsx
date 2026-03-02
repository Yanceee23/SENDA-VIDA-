import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppProviders } from './src/state/AppProviders';
import { navigationTheme } from './src/theme/navigationTheme';
import { navigationRef } from './src/navigation/navigationRef';
import { STORAGE_KEYS } from './src/config';
import { setJson } from './src/services/storage';

export default function App() {
  useEffect(() => {
    const handleUrl = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        const token = parsed?.queryParams?.token;
        const path = String(parsed?.path ?? '').toLowerCase();
        const isJoin = path === 'join' || path.endsWith('/join');
        if (isJoin && typeof token === 'string' && token.trim()) {
          void setJson(STORAGE_KEYS.pendingInvite, { token: token.trim(), receivedAt: new Date().toISOString(), url });
          if (navigationRef.isReady()) {
            navigationRef.navigate('Tabs', { screen: 'Comunidad' });
          }
        }
      } catch {
        // ignore
      }
    };

    void Linking.getInitialURL().then((u) => {
      if (u) handleUrl(u);
    });

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <NavigationContainer
            ref={navigationRef}
            theme={navigationTheme}
            linking={{ prefixes: [Linking.createURL('/'), 'sendavida://'] }}
          >
            <AppNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
