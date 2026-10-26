import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TextLink } from '@/components/TextLink';
import { supabase } from '@/db/supabase';
import { friendlyAuthError, validateCredentials, type AuthMode } from '@/lib/auth';
import { spacing } from '@/theme';

// Where links in confirmation and reset emails send people back to.
const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;

// Shown whenever nobody is signed in. A successful sign-in updates the session in
// AuthProvider, and the root layout switches to the app.
export default function SignInScreen() {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signingUp = mode === 'signUp';

  const submit = async () => {
    const invalid = validateCredentials(email, password, mode);
    setError(invalid);
    setNotice(null);
    if (invalid) return;
    setBusy(true);
    try {
      const address = email.trim();
      if (signingUp) {
        const { data, error: err } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (err) throw err;
        // Supabase answers a sign-up for an existing address with an empty user
        // instead of an error, so it can't be used to discover who has an account.
        if (data.user && data.user.identities?.length === 0) {
          setError('An account with that email already exists. Log in instead.');
        } else if (!data.session) {
          setNotice(`Almost there — we sent a confirmation link to ${address}. Open it, then log in here.`);
          setMode('signIn');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: address, password });
        if (err) throw err;
      }
    } catch (e) {
      setError(friendlyAuthError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    const invalid = validateCredentials(email, 'x', 'signIn');
    if (invalid) {
      setError('Enter your email above, then tap “Forgot password?” again.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    if (err) setError(friendlyAuthError(err.message));
    else {
      setError(null);
      setNotice(`If ${email.trim()} has an account, a reset link is on its way.`);
    }
  };

  return (
    <Screen title="FitFreak" subtitle="Training splits, workouts, macros, and water — in one place.">
      <Card style={styles.card}>
        <AppText variant="caption" muted>
          {signingUp ? 'Create your account' : 'Log in'}
        </AppText>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          onSubmitEditing={submit}
        />
        {error ? <AppText variant="caption">{error}</AppText> : null}
        {notice ? <AppText variant="caption" muted>{notice}</AppText> : null}
        <Button label={busy ? 'Please wait…' : signingUp ? 'Create account' : 'Log in'} onPress={submit} disabled={busy} />
        <View style={styles.links}>
          <TextLink
            label={signingUp ? 'Have an account? Log in' : 'New here? Create an account'}
            onPress={() => {
              setMode(signingUp ? 'signIn' : 'signUp');
              setError(null);
              setNotice(null);
            }}
          />
          {signingUp ? null : <TextLink label="Forgot password?" onPress={resetPassword} />}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
