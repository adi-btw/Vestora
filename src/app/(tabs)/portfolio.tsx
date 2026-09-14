import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useDirectionColor } from '@/components/market/price-change';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorView } from '@/components/ui/error-view';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { EquityCurve } from '@/features/portfolio/components/equity-curve';
import { OrderRow } from '@/features/portfolio/components/order-row';
import { PositionRow } from '@/features/portfolio/components/position-row';
import {
  useCancelOrder,
  useEquityCurve,
  useOrders,
  usePortfolioSummary,
} from '@/features/portfolio/hooks';
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from '@/lib/format';

export default function PortfolioScreen() {
  const router = useRouter();
  const { summary, isLoading, isError, error, refetch } = usePortfolioSummary();
  const orders = useOrders();
  const curve = useEquityCurve();
  const cancelOrder = useCancelOrder();

  const returnColor = useDirectionColor(summary?.totalReturn);

  return (
    <Screen scroll onRefresh={refetch} refreshing={isLoading} contentStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">Portfolio</ThemedText>
        <Badge label="Simulated money" tone="warning" />
      </View>

      {isError ? (
        <ErrorView error={error} onRetry={refetch} />
      ) : (
        <Card>
          {isLoading || !summary ? (
            <View style={styles.summaryLoading}>
              <Skeleton width={200} height={38} />
              <Skeleton width={140} height={16} />
            </View>
          ) : (
            <>
              <ThemedText type="caption" themeColor="textMuted">
                Total equity
              </ThemedText>
              <ThemedText type="display">{formatCurrency(summary.equity)}</ThemedText>
              <ThemedText type="small" color={returnColor}>
                {formatSignedCurrency(summary.totalReturn)} (
                {formatSignedPercent(summary.totalReturnPercent)}) all time
              </ThemedText>

              <View style={styles.stats}>
                <Stat label="Cash" value={formatCurrency(summary.cash)} />
                <Stat label="Positions" value={formatCurrency(summary.positionsValue)} />
                <Stat label="Unrealized" value={formatSignedCurrency(summary.unrealizedPnl)} />
                <Stat label="Realized" value={formatSignedCurrency(summary.realizedPnl)} />
              </View>
            </>
          )}
        </Card>
      )}

      <Card>
        <SectionHeader title="Equity curve" subtitle="One snapshot per day" />
        {curve.isLoading ? (
          <Skeleton height={180} />
        ) : (
          <EquityCurve
            snapshots={curve.data ?? []}
            startingCash={summary?.startingCash ?? 100000}
          />
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Holdings"
          subtitle={summary?.positions.length ? `${summary.positions.length} open` : undefined}
        />

        {isLoading ? (
          <SkeletonList count={3} />
        ) : (summary?.positions ?? []).length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="No positions yet"
            description="Practice with simulated cash - pick a stock and place your first order."
            actionLabel="Find a symbol"
            onAction={() => router.push('/search')}
          />
        ) : (
          <View>
            {(summary?.positions ?? []).map((position) => (
              <PositionRow key={position.symbol} position={position} />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionHeader title="Order history" />

        {orders.isError ? (
          <ErrorView error={orders.error} onRetry={orders.refetch} compact />
        ) : orders.isLoading ? (
          <SkeletonList count={3} />
        ) : (orders.data ?? []).length === 0 ? (
          <ThemedText type="small" themeColor="textMuted">
            Orders you place will show up here.
          </ThemedText>
        ) : (
          <View>
            {(orders.data ?? []).map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onCancel={cancelOrder.mutate}
                isCanceling={cancelOrder.isPending}
              />
            ))}
          </View>
        )}
      </Card>

      <ThemedText type="caption" themeColor="textMuted">
        Every order here is simulated against cached market prices. No brokerage is connected and no
        real money moves.
      </ThemedText>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  summaryLoading: {
    gap: Spacing.two,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  stat: {
    minWidth: 92,
    gap: 1,
  },
});
