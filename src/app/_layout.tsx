import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/ui/error-boundary';
import { SetupNotice } from '@/components/ui/setup-notice';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { useColorSchemeName } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/env';
import { createQueryClient } from '@/lib/query-client';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  // Rendering the navigator before the stored session is known would flash the
  // sign-in screen for returning users.
  if (isLoading) return null;

  const isSignedIn = Boolean(session);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="symbol/[symbol]" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ presentation: 'modal', title: 'Search symbols' }} />
        <Stack.Screen name="alert/[symbol]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="trade/[symbol]" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorSchemeName();
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    if (!isSupabaseConfigured) void SplashScreen.hideAsync();
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {isSupabaseConfigured ? (
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <RootNavigator />
              </AuthProvider>
            </QueryClientProvider>
          ) : (
            <SetupNotice />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
