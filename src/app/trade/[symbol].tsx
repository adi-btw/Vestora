import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorView } from '@/components/ui/error-view';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useQuote } from '@/features/market/hooks';
import { usePlaceOrder, usePortfolioSummary } from '@/features/portfolio/hooks';
import type { Order } from '@/features/portfolio/schemas';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency, formatQuantity } from '@/lib/format';

const SIDE_OPTIONS = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
] as const;

const TYPE_OPTIONS = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
] as const;

export default function TradeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ symbol: string }>();
  const symbol = (params.symbol ?? '').toUpperCase();

  const { quote } = useQuote(symbol);
  const { summary } = usePortfolioSummary();
  const placeOrder = usePlaceOrder();

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<Order | null>(null);

  const price = quote?.price ?? null;
  const held = summary?.positions.find((position) => position.symbol === symbol);
  const cash = summary?.cash ?? 0;

  const parsedQuantity = Number(quantity);
  const referencePrice = orderType === 'limit' ? Number(limitPrice) || price : price;
  const estimatedCost =
    Number.isFinite(parsedQuantity) && parsedQuantity > 0 && referencePrice
      ? parsedQuantity * referencePrice
      : null;

  const maxAffordable = useMemo(() => {
    if (side === 'sell') return held?.quantity ?? 0;
    if (!referencePrice || referencePrice <= 0) return 0;
    return Math.floor((cash / referencePrice) * 10000) / 10000;
  }, [side, held?.quantity, cash, referencePrice]);

  async function submit() {
    setValidationError(null);
    setResult(null);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setValidationError('Enter how many shares you want.');
      return;
    }
    if (
      orderType === 'limit' &&
      (!Number.isFinite(Number(limitPrice)) || Number(limitPrice) <= 0)
    ) {
      setValidationError('Enter a limit price.');
      return;
    }
    if (side === 'sell' && parsedQuantity > (held?.quantity ?? 0)) {
      setValidationError(`You hold ${formatQuantity(held?.quantity ?? 0)} shares.`);
      return;
    }

    try {
      const response = await placeOrder.mutateAsync({
        symbol,
        side,
        orderType,
        quantity: parsedQuantity,
        limitPrice: orderType === 'limit' ? Number(limitPrice) : undefined,
      });

      setResult(response.order);
      if (response.order.status === 'filled') setQuantity('');
    } catch {
      // Rendered from the mutation's error state.
    }
  }

  if (!symbol) {
    return <ErrorView error={new Error('No symbol provided.')} onRetry={() => router.back()} />;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.six },
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="heading">Trade {symbol}</ThemedText>
        <Badge label="Simulated" tone="warning" />
      </View>

      <Card>
        <View style={styles.summaryRow}>
          <View>
            <ThemedText type="caption" themeColor="textMuted">
              Last price
            </ThemedText>
            <ThemedText type="subtitle">{formatCurrency(price)}</ThemedText>
          </View>
          <View style={styles.summaryRight}>
            <ThemedText type="caption" themeColor="textMuted">
              {side === 'buy' ? 'Buying power' : 'Shares held'}
            </ThemedText>
            <ThemedText type="subtitle">
              {side === 'buy' ? formatCurrency(cash) : formatQuantity(held?.quantity ?? 0)}
            </ThemedText>
          </View>
        </View>
      </Card>

      <SegmentedControl options={SIDE_OPTIONS} value={side} onChange={setSide} />
      <SegmentedControl options={TYPE_OPTIONS} value={orderType} onChange={setOrderType} />

      <Card>
        <SectionHeader
          title="Order"
          subtitle={
            orderType === 'market'
              ? 'Fills immediately at the latest cached price'
              : 'Fills on the next scan once your price is reached'
          }
        />

        <View style={styles.fields}>
          <TextField
            label="Shares"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="decimal-pad"
            hint={
              maxAffordable > 0
                ? `Up to ${formatQuantity(maxAffordable)} at this price`
                : side === 'buy'
                  ? 'Not enough cash for a share at this price.'
                  : 'You have no shares to sell.'
            }
          />

          {orderType === 'limit' ? (
            <TextField
              label="Limit price"
              value={limitPrice}
              onChangeText={setLimitPrice}
              placeholder={price ? price.toFixed(2) : '0.00'}
              keyboardType="decimal-pad"
              hint={
                side === 'buy' ? 'Fills at or below this price.' : 'Fills at or above this price.'
              }
            />
          ) : null}

          {maxAffordable > 0 ? (
            <Pressable
              onPress={() => setQuantity(String(maxAffordable))}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.maxChip,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.75 : 1 },
              ]}>
              <ThemedText type="caption" themeColor="accent">
                {side === 'buy' ? 'Max affordable' : 'Sell all'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {estimatedCost !== null ? (
          <View style={[styles.estimate, { borderTopColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Estimated {side === 'buy' ? 'cost' : 'proceeds'}
            </ThemedText>
            <ThemedText type="bodyBold">{formatCurrency(estimatedCost)}</ThemedText>
          </View>
        ) : null}
      </Card>

      {validationError ? (
        <ThemedText type="small" color={theme.down}>
          {validationError}
        </ThemedText>
      ) : null}

      {placeOrder.isError ? <ErrorView error={placeOrder.error} compact /> : null}

      {result ? <OrderOutcome order={result} /> : null}

      <Button
        label={`${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
        onPress={submit}
        loading={placeOrder.isPending}
        variant={side === 'buy' ? 'primary' : 'danger'}
      />
    </ScrollView>
  );
}

/** The server decides whether an order fills, so echo back exactly what happened. */
function OrderOutcome({ order }: { order: Order }) {
  const theme = useTheme();

  const palette = {
    filled: { background: theme.upSoft, text: theme.up, icon: 'checkmark-circle' as const },
    pending: { background: theme.warningSoft, text: theme.warning, icon: 'time-outline' as const },
    rejected: { background: theme.downSoft, text: theme.down, icon: 'close-circle' as const },
    canceled: {
      background: theme.backgroundElement,
      text: theme.textSecondary,
      icon: 'remove-circle-outline' as const,
    },
  }[order.status];

  const message =
    order.status === 'filled'
      ? `Filled ${formatQuantity(order.quantity)} ${order.symbol} at ${formatCurrency(order.filled_price)}.`
      : order.status === 'pending'
        ? `Working: ${order.side} ${formatQuantity(order.quantity)} ${order.symbol} at ${formatCurrency(order.limit_price)} or better.`
        : (order.reject_reason ?? 'That order did not go through.');

  return (
    <View style={[styles.outcome, { backgroundColor: palette.background }]}>
      <Ionicons name={palette.icon} size={16} color={palette.text} />
      <ThemedText type="small" color={palette.text} style={styles.outcomeText}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  fields: {
    gap: Spacing.two,
    paddingTop: Spacing.three - 4,
  },
  maxChip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingTop: Spacing.two + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  outcome: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
  },
  outcomeText: {
    flex: 1,
  },
});
