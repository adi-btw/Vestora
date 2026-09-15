import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Disclaimer } from '@/components/ui/disclaimer';
import { ErrorView } from '@/components/ui/error-view';
import { GroupedSection } from '@/components/ui/grouped-section';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { RecommendationCard } from '@/features/recommendations/components/recommendation-card';
import {
  useDismissRecommendation,
  useRecommendations,
  useRefreshRecommendations,
} from '@/features/recommendations/hooks';
import { formatRelativeTime } from '@/lib/format';

export function RecommendationList() {
  const { data: recommendations = [], isLoading, isError, error, refetch } = useRecommendations();
  const refresh = useRefreshRecommendations();
  const dismiss = useDismissRecommendation();

  const generatedAt = recommendations[0]?.generatedAt ?? null;

  return (
    <View style={styles.container}>
      <GroupedSection
        title="Ideas for you"
        subtitle={
          generatedAt
            ? `Scored ${formatRelativeTime(generatedAt)} from peers of your watchlist`
            : 'Scored from peers of the stocks you follow'
        }>
        {isError ? (
          <ErrorView error={error} onRetry={refetch} compact />
        ) : isLoading ? (
          <View style={styles.loading}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : recommendations.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText type="small" themeColor="textSecondary">
              Generate a set of ideas scored on growth, quality, valuation, momentum and analyst
              consensus.
            </ThemedText>
          </View>
        ) : (
          <View>
            {recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.symbol}
                recommendation={recommendation}
                onDismiss={dismiss.mutate}
              />
            ))}
          </View>
        )}
      </GroupedSection>

      {refresh.isError ? <ErrorView error={refresh.error} compact /> : null}

      <Button
        label={recommendations.length === 0 ? 'Generate ideas' : 'Refresh ideas'}
        onPress={() => refresh.mutate()}
        variant="secondary"
        loading={refresh.isPending}
      />

      <Disclaimer compact />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  loading: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  empty: {
    padding: Spacing.three,
  },
});
