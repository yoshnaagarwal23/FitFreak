import assert from 'node:assert/strict';
import { friendlyAuthError, validateCredentials, validateNewPassword } from '@/lib/auth';

assert.equal(validateCredentials('me@example.com', 'whatever', 'signIn'), null);
assert.match(validateCredentials('not-an-email', 'whatever', 'signIn')!, /valid email/);
assert.match(validateCredentials(' me@example.com ', '', 'signIn')!, /Enter your password/);
assert.match(validateCredentials('me@example.com', 'short', 'signUp')!, /at least 8/);
assert.equal(validateCredentials('me@example.com', 'short', 'signIn'), null, 'old short passwords can still log in');
assert.equal(validateNewPassword('longenough', 'longenough'), null);
assert.match(validateNewPassword('longenough', 'different1')!, /don’t match/);
assert.match(friendlyAuthError('Invalid login credentials'), /don’t match an account/);
assert.match(friendlyAuthError('Email not confirmed'), /Confirm your email/);
assert.match(friendlyAuthError('TypeError: Failed to fetch'), /Can’t reach/);
assert.equal(friendlyAuthError('Something new'), 'Something new');
console.log('ALL AUTH CHECKS PASSED');
