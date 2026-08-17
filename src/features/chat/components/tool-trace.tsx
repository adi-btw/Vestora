import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ToolCall } from '@/features/chat/schemas';
import { useTheme } from '@/hooks/use-theme';

function symbolList(args: Record<string, unknown>): string {
  const value = args.symbols ?? args.symbol ?? args.query;
  if (Array.isArray(value)) return value.map(String).join(', ');
  return value == null ? '' : String(value);
}

/** Turns a raw tool call into the one-liner a user can actually read. */
function describe(call: ToolCall): string {
  const target = symbolList(call.args);

  switch (call.name) {
    case 'get_quotes':
      return `Checked prices for ${target}`;
    case 'get_company':
      return `Looked up fundamentals for ${target}`;
    case 'get_news':
      return `Read recent news on ${target}`;
    case 'get_price_history':
      return `Reviewed price history for ${target}`;
    case 'search_symbols':
      return `Searched for "${target}"`;
    case 'get_watchlist':
      return 'Read your watchlist';
    case 'add_to_watchlist':
      return call.pending ? `Wants to add ${target}` : `Added ${target} to your watchlist`;
    default:
      return call.name;
  }
}

export function ToolTrace({ calls }: { calls: ToolCall[] }) {
  const theme = useTheme();
  const visible = calls.filter((call) => !call.pending);
  if (visible.length === 0) return null;

  return (
    <View style={styles.container}>
      {visible.map((call, index) => (
        <View key={`${call.name}-${index}`} style={styles.row}>
          <Ionicons
            name={call.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={12}
            color={call.ok ? theme.textMuted : theme.warning}
          />
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={1} style={styles.label}>
            {describe(call)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
    paddingBottom: Spacing.one + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  label: {
    flex: 1,
  },
});
