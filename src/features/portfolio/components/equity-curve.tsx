import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PriceChart } from '@/components/market/price-chart';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Bar } from '@/features/market/schemas';
import type { PortfolioSnapshotRow } from '@/lib/database.types';

type EquityCurveProps = {
  snapshots: PortfolioSnapshotRow[];
  startingCash: number;
};

/**
 * The equity curve reuses the price chart: a daily equity series has the same
 * shape as a close series, so it gets the same rendering and scrubbing for free.
 */
export function EquityCurve({ snapshots, startingCash }: EquityCurveProps) {
  const bars = useMemo<Bar[]>(
    () =>
      snapshots.map((snapshot) => {
        const equity = Number(snapshot.equity);
        return { t: snapshot.captured_on, o: equity, h: equity, l: equity, c: equity, v: 0 };
      }),
    [snapshots],
  );

  if (bars.length < 2) {
    return (
      <View style={styles.empty}>
        <ThemedText type="small" themeColor="textMuted">
          The equity curve fills in once a day, starting the day after your first trade.
        </ThemedText>
      </View>
    );
  }

  // Baseline at the opening balance: above it is profit, below it is loss.
  return <PriceChart bars={bars} height={180} baseline={startingCash} />;
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: Spacing.three,
  },
});
