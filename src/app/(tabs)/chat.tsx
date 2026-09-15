import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Disclaimer } from '@/components/ui/disclaimer';
import { ErrorView } from '@/components/ui/error-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { Composer } from '@/features/chat/components/composer';
import { MessageBubble } from '@/features/chat/components/message-bubble';
import { PendingActionCard } from '@/features/chat/components/pending-action-card';
import { ThreadBar } from '@/features/chat/components/thread-bar';
import { useChat, useThreads } from '@/features/chat/hooks';
import type { ChatMessage } from '@/features/chat/schemas';
import { useWatchlistItems } from '@/features/watchlist/hooks';
import { useTheme } from '@/hooks/use-theme';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const { data: threads = [] } = useThreads();
  const { symbols } = useWatchlistItems();
  const chat = useChat();

  const suggestions = useMemo(() => {
    const [first, second] = symbols;
    return [
      first ? `How has ${first} been doing lately?` : 'What is moving in the market today?',
      second
        ? `Compare ${first} and ${second} on valuation.`
        : 'Explain P/E ratio like I am new to investing.',
      symbols.length > 0
        ? 'Any news I should know about on my watchlist?'
        : 'Find me the ticker for Nvidia.',
    ];
  }, [symbols]);

  // Keep the newest turn in view as the transcript grows.
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [chat.messages.length, chat.draftEcho, chat.pendingAction]);

  const echo: ChatMessage | null = chat.draftEcho
    ? {
        id: 'draft',
        role: 'user',
        content: chat.draftEcho,
        tool_calls: null,
        created_at: new Date().toISOString(),
      }
    : null;

  const isEmpty = chat.messages.length === 0 && !echo;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <ThemedText type="title">Advisor</ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            Grounded in live quotes, fundamentals and news - never financial advice.
          </ThemedText>
        </View>

        <ThreadBar
          threads={threads}
          activeThreadId={chat.threadId}
          onSelect={chat.openThread}
          onNewThread={chat.startNewThread}
        />

        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          keyboardShouldPersistTaps="handled">
          {isEmpty ? (
            <View style={styles.intro}>
              <ThemedText type="subtitle">What would you like to look into?</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                The advisor pulls real data before it answers, so ask about specific tickers.
              </ThemedText>

              <View style={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => chat.send(suggestion)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.suggestion,
                      {
                        backgroundColor: theme.backgroundElement,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}>
                    <ThemedText type="small">{suggestion}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
              {chat.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {echo ? <MessageBubble message={echo} /> : null}
            </>
          )}

          {chat.isSending ? (
            <View style={styles.thinking}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <ThemedText type="caption" themeColor="textMuted">
                Pulling data and thinking...
              </ThemedText>
            </View>
          ) : null}

          {chat.pendingAction ? (
            <PendingActionCard
              action={chat.pendingAction}
              isPending={chat.isSending}
              onConfirm={chat.confirm}
              onDismiss={chat.dismissAction}
            />
          ) : null}

          {chat.error ? <ErrorView error={chat.error} compact /> : null}
        </ScrollView>

        <Disclaimer />
      </View>

      <View style={[styles.composerWrap, { paddingBottom: insets.bottom }]}>
        <Composer onSend={chat.send} isSending={chat.isSending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  header: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three - 4,
  },
  transcript: {
    flex: 1,
  },
  transcriptContent: {
    paddingBottom: Spacing.three,
  },
  intro: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  suggestions: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  suggestion: {
    borderRadius: Radius.lg,
    padding: Spacing.three - 2,
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  composerWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
