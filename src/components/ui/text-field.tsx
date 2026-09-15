import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, style, ...rest },
  ref,
) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      {label ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        ref={ref}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.down : 'transparent',
            borderWidth: error ? StyleSheet.hairlineWidth : 0,
            color: theme.text,
          },
          style,
        ]}
        placeholderTextColor={theme.textMuted}
        {...rest}
      />
      {error ? (
        <ThemedText type="caption" themeColor="down">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textMuted">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
    width: '100%',
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 17,
    minHeight: 44,
  },
});
