import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.includes('@') && password.length >= 6 && !submitting;

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice('Check your inbox to confirm the address, then sign in.');
          setMode('sign-in');
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not authenticate.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="trending-up" size={28} color={theme.accent} />
          </View>
          <ThemedText type="display">Vestora</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            Track the tickers you care about, get alerts that matter, and ask an AI advisor that
            reads live market data before it answers.
          </ThemedText>
        </View>

        <Card style={styles.form}>
          <ThemedText type="heading">
            {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
          </ThemedText>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            placeholder="At least 6 characters"
            hint={mode === 'sign-up' ? 'Minimum 6 characters.' : undefined}
            onSubmitEditing={() => {
              if (canSubmit) void handleSubmit();
            }}
          />

          {error ? (
            <ThemedText type="small" themeColor="down">
              {error}
            </ThemedText>
          ) : null}
          {notice ? (
            <ThemedText type="small" themeColor="accent">
              {notice}
            </ThemedText>
          ) : null}

          <Button
            label={mode === 'sign-in' ? 'Sign in' : 'Create account'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />
          <Button
            label={mode === 'sign-in' ? 'No account yet? Sign up' : 'Already registered? Sign in'}
            onPress={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setError(null);
              setNotice(null);
            }}
            variant="ghost"
            size="sm"
          />
        </Card>

        <ThemedText type="caption" themeColor="textMuted" style={styles.legal}>
          Educational project. Simulated trading only - no real orders are ever placed.
        </ThemedText>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.four,
    justifyContent: 'center',
    paddingVertical: Spacing.five,
  },
  hero: {
    gap: Spacing.two,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  form: {
    gap: Spacing.three,
  },
  legal: {
    textAlign: 'center',
  },
});
