import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { FactorBar } from '@/features/recommendations/components/factor-bar';
import type { Recommendation } from '@/features/recommendations/schemas';
import { useTheme } from '@/hooks/use-theme';

type RecommendationCardProps = {
  recommendation: Recommendation;
  onDismiss: (symbol: string) => void;
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return 'High confidence';
  if (confidence >= 0.45) return 'Medium confidence';
  return 'Low confidence';
}

export function RecommendationCard({ recommendation, onDismiss }: RecommendationCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const [showFactors, setShowFactors] = useState(false);

  const { symbol, score, thesis, risks, confidence, signals } = recommendation;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push(`/symbol/${symbol}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${symbol}`}
          style={styles.identity}>
          <ThemedText type="subtitle">{symbol}</ThemedText>
          {signals.name ? (
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
              {signals.name}
            </ThemedText>
          ) : null}
        </Pressable>

        <View style={[styles.scorePill, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="captionBold" themeColor="accent">
            {score.toFixed(0)}
          </ThemedText>
        </View>

        <Pressable
          onPress={() => onDismiss(symbol)}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${symbol}`}
          hitSlop={8}>
          <Ionicons name="close" size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      <ThemedText type="small">{thesis}</ThemedText>

      <View style={styles.risks}>
        <Ionicons name="warning-outline" size={13} color={theme.warning} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.risksText}>
          {risks}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <Badge
          label={confidenceLabel(confidence)}
          tone={confidence >= 0.7 ? 'up' : confidence >= 0.45 ? 'neutral' : 'warning'}
        />
        {signals.aiGenerated ? <Badge label="AI explained" tone="accent" /> : null}

        <Pressable
          onPress={() => setShowFactors((current) => !current)}
          accessibilityRole="button"
          hitSlop={6}
          style={styles.toggle}>
          <ThemedText type="captionBold" themeColor="accent">
            {showFactors ? 'Hide factors' : 'Why this score'}
          </ThemedText>
        </Pressable>
      </View>

      {showFactors && signals.factors.length > 0 ? (
        <View style={styles.factors}>
          {signals.factors.map((factor) => (
            <FactorBar key={factor.key} factor={factor} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  identity: {
    flex: 1,
    gap: 1,
  },
  scorePill: {
    minWidth: 34,
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  risks: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one + 2,
  },
  risksText: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  toggle: {
    marginLeft: 'auto',
  },
  factors: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
});
