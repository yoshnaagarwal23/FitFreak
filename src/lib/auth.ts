// Validation and messages for the sign-in screens. No network here.

export const MIN_PASSWORD_LENGTH = 8;

export type AuthMode = 'signIn' | 'signUp';

export function validateCredentials(email: string, password: string, mode: AuthMode): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }
  if (password.length === 0) return 'Enter your password.';
  return null;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return 'The passwords don’t match.';
  return null;
}

// Turns Supabase Auth errors into plain sentences; unknown ones pass through.
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match an account.';
  if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox for the link.';
  if (m.includes('already registered')) return 'An account with that email already exists. Log in instead.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can’t reach the server. Check your connection.';
  return message;
}
