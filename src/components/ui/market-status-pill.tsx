import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMarketStatus, MARKET_STATUS_LABELS } from '@/lib/market-hours';

/** Explains why prices are not moving, which otherwise reads as a broken feed. */
export function MarketStatusPill() {
  const theme = useTheme();
  const [status, setStatus] = useState(() => getMarketStatus());

  useEffect(() => {
    const timer = setInterval(() => setStatus(getMarketStatus()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const isOpen = status === 'open';
  const dotColor = isOpen ? theme.up : status === 'closed' ? theme.textMuted : theme.warning;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <ThemedText type="caption" themeColor="textSecondary">
        {MARKET_STATUS_LABELS[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
