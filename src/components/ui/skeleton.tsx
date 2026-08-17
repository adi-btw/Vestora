import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = '100%',
  height = 16,
  radius = Radius.sm,
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.skeleton },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Placeholder shaped like a watchlist row, shown while the first fetch runs. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Skeleton width={64} height={18} />
        <Skeleton width={120} height={12} />
      </View>
      <View style={styles.rowRight}>
        <Skeleton width={80} height={18} />
        <Skeleton width={56} height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  rowLeft: {
    gap: Spacing.two,
  },
  rowRight: {
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
});
