import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { importLocalData } from '@/db/importLocal';
import {
  getImportMark,
  hasData,
  LOCAL_DATABASE_NAME,
  readLocalSnapshot,
  setImportMark,
  summarize,
  type LocalSnapshot,
} from '@/db/local/snapshot';
import { useDb } from '@/db/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

type State =
  | { kind: 'checking' }
  | { kind: 'nothing' }
  | { kind: 'alreadyImported'; email: string }
  | { kind: 'ready'; snapshot: LocalSnapshot }
  | { kind: 'importing' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; snapshot: LocalSnapshot; message: string };

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const GLASS: [string, string] = ['glass of water', 'glasses of water'];
const ENTRY: [string, string] = ['food entry', 'food entries'];

// Offers to copy data logged in this browser before accounts existed. Renders nothing
// when there is none.
export function LocalImportCard() {
  const db = useDb();
  const { session } = useAuth();
  const local = useRef<SQLiteDatabase | null>(null);
  const [state, setState] = useState<State>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sqlite = await openDatabaseAsync(LOCAL_DATABASE_NAME);
        local.current = sqlite;
        const snapshot = await readLocalSnapshot(sqlite);
        const mark = snapshot ? await getImportMark(sqlite) : null;
        if (cancelled) return;
        if (mark) setState({ kind: 'alreadyImported', email: mark.email });
        else if (snapshot && hasData(snapshot)) setState({ kind: 'ready', snapshot });
        else setState({ kind: 'nothing' });
      } catch {
        if (!cancelled) setState({ kind: 'nothing' }); // no local storage available here
      }
    })();
    return () => {
      cancelled = true;
      local.current?.closeAsync().catch(() => {});
    };
  }, []);

  const runImport = async (snapshot: LocalSnapshot) => {
    setState({ kind: 'importing' });
    try {
      const r = await importLocalData(db, snapshot);
      if (local.current) await setImportMark(local.current, session?.user.email ?? 'your account');
      setState({
        kind: 'done',
        message: `Imported ${count(r.workouts, 'workout')}, ${count(r.sets, 'set')}, ${count(r.food_logs, ...ENTRY)}, and ${count(r.water_logs, ...GLASS)}.`,
      });
    } catch (e) {
      setState({ kind: 'error', snapshot, message: e instanceof Error ? e.message : String(e) });
    }
  };

  if (state.kind === 'checking' || state.kind === 'nothing') return null;

  return (
    <Card>
      <AppText>Data saved in this browser</AppText>
      {state.kind === 'alreadyImported' ? (
        <AppText variant="caption" muted>
          Already copied to {state.email}. It stays in this browser too, but new entries only go to your account.
        </AppText>
      ) : state.kind === 'importing' ? (
        <AppText variant="caption" muted>
          Importing…
        </AppText>
      ) : state.kind === 'done' ? (
        <AppText variant="caption" muted>
          {state.message}
        </AppText>
      ) : (
        <>
          <AppText variant="caption" muted>
            {describe(state.snapshot)} from before you had an account. Copy it into your account? You can only do this
            once.
          </AppText>
          {state.kind === 'error' ? <AppText variant="caption">Import failed: {state.message}</AppText> : null}
          <Button label="Import into my account" onPress={() => runImport(state.snapshot)} />
        </>
      )}
    </Card>
  );
}

function describe(s: LocalSnapshot) {
  const n = summarize(s);
  const parts = [
    n.workouts && count(n.workouts, 'workout'),
    n.foodLogs && count(n.foodLogs, ...ENTRY),
    n.waterLogs && count(n.waterLogs, ...GLASS),
    n.splits && count(n.splits, 'split'),
  ].filter(Boolean);
  return parts.length > 0 ? `This browser has ${parts.join(', ')}` : 'This browser has your settings';
}
