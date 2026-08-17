import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';
import { env } from '@/lib/env';

const isWeb = Platform.OS === 'web';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    // On web the default `localStorage` adapter is the right one; on native we
    // need an explicit async adapter.
    storage: isWeb ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Only the web build can receive an OAuth redirect in the URL fragment.
    detectSessionInUrl: isWeb,
    flowType: 'pkce',
  },
});

if (!isWeb) {
  // Refreshing tokens while the app is backgrounded wastes battery and can fail
  // silently, so mirror Supabase's recommended AppState wiring.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
