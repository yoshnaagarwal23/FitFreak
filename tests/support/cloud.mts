// Test helpers for the cloud data layer. scripts/test-db.sh starts a throwaway Postgres
// with the migrations applied and PostgREST in front of it, then sets these variables.
import { PostgrestClient } from '@supabase/postgrest-js';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import type { Db } from '@/db/client';

const { TEST_API_URL, TEST_JWT_SECRET, TEST_PG_HOST, TEST_PG_PORT } = process.env;
if (!TEST_API_URL || !TEST_JWT_SECRET) throw new Error('Run these tests with `npm run test:db`.');

// Runs SQL as the database owner (bypassing row-level security) and returns the output.
export function sql(query: string): string {
  return execFileSync(
    'psql',
    ['-h', TEST_PG_HOST!, '-p', TEST_PG_PORT!, '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A',
     '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding: 'utf8' },
  ).trim();
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

// The same kind of token Supabase Auth issues: HS256, role "authenticated", sub = user id.
function accessToken(userId: string) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: userId,
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  return `${body}.${createHmac('sha256', TEST_JWT_SECRET!).update(body).digest('base64url')}`;
}

// A brand-new account and a client signed in as it.
export function newUser(): { id: string; db: Db } {
  const id = randomUUID();
  sql(`insert into auth.users (id) values ('${id}')`);
  const client = new PostgrestClient(TEST_API_URL!, { headers: { Authorization: `Bearer ${accessToken(id)}` } });
  return { id, db: client as unknown as Db };
}

// A client with no session, like a logged-out visitor.
export const visitorDb = new PostgrestClient(TEST_API_URL!) as unknown as Db;
