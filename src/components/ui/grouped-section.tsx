import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type GroupedSectionProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Extra styles on the elevated group (not the outer wrapper). */
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

/**
 * Inset grouped list: elevated fill, continuous corners, no decorative border.
 * Hairline separators belong on the rows inside, not around the group.
 */
export function GroupedSection({
  children,
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
  padded = false,
}: GroupedSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      {title ? (
        <SectionHeader
          title={title}
          subtitle={subtitle}
          actionLabel={actionLabel}
          onAction={onAction}
        />
      ) : null}
      <View
        style={[
          styles.group,
          { backgroundColor: theme.surfaceElevated },
          padded && styles.padded,
          style,
        ]}>
        {children}
      </View>
    </View>
  );
}

export function groupedItemStyle(
  index: number,
  count: number,
  radius: number = Radius.lg,
): ViewStyle {
  const isFirst = index === 0;
  const isLast = index === count - 1;

  return {
    borderTopLeftRadius: isFirst ? radius : 0,
    borderTopRightRadius: isFirst ? radius : 0,
    borderBottomLeftRadius: isLast ? radius : 0,
    borderBottomRightRadius: isLast ? radius : 0,
    overflow: 'hidden',
  };
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  group: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  padded: {
    padding: Spacing.three,
  },
});
