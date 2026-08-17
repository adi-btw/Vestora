import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Use `false` for screens owning a FlatList. */
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
};

/**
 * Every screen's outer frame: themed background, safe-area padding and a capped
 * content width so the web build does not stretch to 2000px.
 */
export function Screen({
  children,
  scroll = false,
  onRefresh,
  refreshing = false,
  contentStyle,
  padded = true,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const inner = (
    <View style={[styles.constrain, padded && styles.padded, contentStyle]}>{children}</View>
  );

  if (!scroll) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        {inner}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.six }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.textSecondary}
          />
        ) : undefined
      }>
      {inner}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  constrain: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: Spacing.three,
  },
});
