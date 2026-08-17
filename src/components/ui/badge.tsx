import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'neutral' | 'up' | 'down' | 'accent' | 'warning';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const theme = useTheme();

  const palette: Record<BadgeTone, { background: string; text: string }> = {
    neutral: { background: theme.backgroundElement, text: theme.textSecondary },
    up: { background: theme.upSoft, text: theme.up },
    down: { background: theme.downSoft, text: theme.down },
    accent: { background: theme.accentSoft, text: theme.accent },
    warning: { background: theme.warningSoft, text: theme.warning },
  };
  const colors = palette[tone];

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }, style]}>
      <ThemedText type="captionBold" color={colors.text}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half + 1,
    alignSelf: 'flex-start',
  },
});
