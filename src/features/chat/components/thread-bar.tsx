import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatThreadRow } from '@/lib/database.types';

type ThreadBarProps = {
  threads: ChatThreadRow[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void;
  onNewThread: () => void;
};

export function ThreadBar({ threads, activeThreadId, onSelect, onNewThread }: ThreadBarProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onNewThread}
        accessibilityRole="button"
        accessibilityLabel="Start a new chat"
        style={({ pressed }) => [
          styles.newChip,
          { backgroundColor: theme.accentSoft, opacity: pressed ? 0.75 : 1 },
        ]}>
        <Ionicons name="add" size={14} color={theme.accent} />
        <ThemedText type="captionBold" themeColor="accent">
          New
        </ThemedText>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}>
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          return (
            <Pressable
              key={thread.id}
              onPress={() => onSelect(thread.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isActive ? theme.backgroundSelected : theme.backgroundElement,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <ThemedText
                type="caption"
                themeColor={isActive ? 'text' : 'textSecondary'}
                numberOfLines={1}
                style={styles.chipLabel}>
                {thread.title}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  newChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  chip: {
    maxWidth: 160,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  chipLabel: {
    flexShrink: 1,
  },
});
