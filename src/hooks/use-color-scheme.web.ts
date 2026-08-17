import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeToNothing = () => () => {};

/**
 * The web build is statically rendered, so the first paint has no access to the
 * user's color scheme. `useSyncExternalStore` gives a hydration-safe flag - the
 * server snapshot is always `false`, the client snapshot always `true` - which
 * avoids both a hydration mismatch and a setState-in-effect cascade.
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  const hasHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  return hasHydrated ? colorScheme : 'light';
}
