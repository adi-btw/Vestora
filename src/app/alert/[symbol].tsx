import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorView } from '@/components/ui/error-view';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useCreateAlert } from '@/features/alerts/hooks';
import { ALERT_KIND_LABELS, ALERT_KIND_SHORT_LABELS, ALERT_KINDS } from '@/features/alerts/schemas';
import { useQuote } from '@/features/market/hooks';
import { useTheme } from '@/hooks/use-theme';
import type { AlertKind } from '@/lib/database.types';
import { formatCurrency } from '@/lib/format';

const COOLDOWN_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '240', label: '4 hours' },
  { value: '1440', label: '1 day' },
];

const KIND_OPTIONS = ALERT_KINDS.map((kind) => ({
  value: kind,
  label: ALERT_KIND_SHORT_LABELS[kind],
}));

export default function CreateAlertScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ symbol: string }>();
  const symbol = (params.symbol ?? '').toUpperCase();

  const { quote } = useQuote(symbol);
  const createAlert = useCreateAlert();

  const [kind, setKind] = useState<AlertKind>('price_above');
  const [threshold, setThreshold] = useState('');
  const [keyword, setKeyword] = useState('');
  const [cooldown, setCooldown] = useState('60');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isNewsAlert = kind === 'news_keyword';

  // Seed the price field from the live quote so the target is one edit away.
  const suggestion = useMemo(() => {
    if (!quote?.price) return null;
    if (kind === 'price_above') return (quote.price * 1.05).toFixed(2);
    if (kind === 'price_below') return (quote.price * 0.95).toFixed(2);
    if (kind === 'percent_move') return '3';
    return null;
  }, [quote?.price, kind]);

  function changeKind(next: AlertKind) {
    setKind(next);
    setThreshold('');
    setValidationError(null);
  }

  async function save() {
    setValidationError(null);

    if (isNewsAlert) {
      if (keyword.trim().length < 2) {
        setValidationError('Enter a keyword of at least two characters.');
        return;
      }
    } else {
      const parsed = Number(threshold);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setValidationError('Enter a positive number.');
        return;
      }
      if (kind === 'percent_move' && parsed > 100) {
        setValidationError('Percent moves above 100% never trigger.');
        return;
      }
    }

    try {
      await createAlert.mutateAsync({
        symbol,
        kind,
        threshold: isNewsAlert ? null : Number(threshold),
        keyword: isNewsAlert ? keyword.trim() : null,
        cooldownMinutes: Number(cooldown),
      });
      router.back();
    } catch {
      // Surfaced by the mutation's error state below.
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
        <ThemedText type="heading">New {symbol} alert</ThemedText>
      </View>

      <Card>
        <View style={styles.priceRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Current price
          </ThemedText>
          <ThemedText type="subtitle">{formatCurrency(quote?.price)}</ThemedText>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Trigger" subtitle={ALERT_KIND_LABELS[kind]} />
        <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={changeKind} />

        <View style={styles.field}>
          {isNewsAlert ? (
            <TextField
              label="Keyword"
              value={keyword}
              onChangeText={setKeyword}
              placeholder="earnings, lawsuit, guidance"
              autoCapitalize="none"
              hint="Matched against headlines for this symbol."
            />
          ) : (
            <TextField
              label={kind === 'percent_move' ? 'Percent move' : 'Price'}
              value={threshold}
              onChangeText={setThreshold}
              placeholder={suggestion ?? (kind === 'percent_move' ? '3' : '100.00')}
              keyboardType="decimal-pad"
              hint={
                kind === 'percent_move'
                  ? 'Fires when the day change exceeds this, up or down.'
                  : undefined
              }
            />
          )}

          {suggestion && !isNewsAlert && threshold.length === 0 ? (
            <Pressable
              onPress={() => setThreshold(suggestion)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.suggestion,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.75 : 1 },
              ]}>
              <ThemedText type="caption" themeColor="accent">
                Use {kind === 'percent_move' ? `${suggestion}%` : `$${suggestion}`}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionHeader
          title="Repeat limit"
          subtitle="Minimum gap between notifications for this alert"
        />
        <SegmentedControl options={COOLDOWN_OPTIONS} value={cooldown} onChange={setCooldown} />
      </Card>

      {validationError ? (
        <ThemedText type="small" color={theme.down}>
          {validationError}
        </ThemedText>
      ) : null}

      {createAlert.isError ? <ErrorView error={createAlert.error} compact /> : null}

      <Button label="Create alert" onPress={save} loading={createAlert.isPending} />

      <ThemedText type="caption" themeColor="textMuted">
        Alerts are evaluated server-side on a schedule, so they fire whether or not the app is open.
      </ThemedText>
    </ScrollView>
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  field: {
    gap: Spacing.two,
    paddingTop: Spacing.three - 4,
  },
  suggestion: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
});
