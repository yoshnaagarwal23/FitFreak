import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyAuthError, validateNewPassword } from '@/lib/auth';
import { spacing } from '@/theme';

// Shown after opening a password-reset link (which signs the user in temporarily).
export default function NewPasswordScreen() {
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const invalid = validateNewPassword(password, confirm);
    setError(invalid);
    if (invalid) return;
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(friendlyAuthError(err.message));
    else finishRecovery();
  };

  return (
    <Screen title="Choose a new password">
      <Card style={styles.card}>
        <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <TextField label="Repeat it" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
        {error ? <AppText variant="caption">{error}</AppText> : null}
        <Button label={busy ? 'Saving…' : 'Save password'} onPress={save} disabled={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
});
