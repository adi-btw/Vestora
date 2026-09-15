import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ComposerProps = {
  onSend: (message: string) => void;
  isSending: boolean;
};

export function Composer({ onSend, isSending }: ComposerProps) {
  const theme = useTheme();
  const [value, setValue] = useState('');

  const canSend = value.trim().length > 0 && !isSending;

  function submit() {
    if (!canSend) return;
    onSend(value);
    setValue('');
  }

  return (
    <View
      style={[
        styles.container,
        { borderTopColor: theme.border, backgroundColor: theme.background },
      ]}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Ask about a stock or your watchlist"
        placeholderTextColor={theme.textMuted}
        multiline
        // Enter sends on web where there is a keyboard; native keeps the newline key.
        blurOnSubmit={Platform.OS === 'web'}
        onSubmitEditing={Platform.OS === 'web' ? submit : undefined}
        editable={!isSending}
        accessibilityLabel="Message"
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            color: theme.text,
          },
        ]}
      />

      <Pressable
        onPress={submit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={({ pressed }) => [
          styles.send,
          {
            backgroundColor: canSend ? theme.accent : theme.backgroundElement,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <Ionicons name="arrow-up" size={18} color={canSend ? theme.accentText : theme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 17,
    lineHeight: 22,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
