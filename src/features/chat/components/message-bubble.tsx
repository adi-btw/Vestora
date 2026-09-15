import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { ToolTrace } from '@/features/chat/components/tool-trace';
import type { ChatMessage } from '@/features/chat/schemas';
import { useTheme } from '@/hooks/use-theme';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const theme = useTheme();

  // Tool rows are receipts for actions the user approved, not conversation.
  if (message.role === 'tool') {
    return (
      <View style={styles.toolRow}>
        <ToolTrace calls={message.tool_calls ?? []} />
        <ThemedText type="caption" themeColor="textMuted">
          {message.content}
        </ThemedText>
      </View>
    );
  }

  const isUser = message.role === 'user';

  return (
    <View style={[styles.wrapper, isUser ? styles.alignRight : styles.alignLeft]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.accent }
            : { backgroundColor: theme.backgroundElement },
        ]}>
        {!isUser && message.tool_calls?.length ? <ToolTrace calls={message.tool_calls} /> : null}
        <ThemedText type="small" color={isUser ? theme.accentText : theme.text}>
          {message.content}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingVertical: Spacing.one,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two + 2,
  },
  toolRow: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
});
