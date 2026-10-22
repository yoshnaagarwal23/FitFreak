import { SQLiteProvider } from 'expo-sqlite';
import type { PropsWithChildren } from 'react';

import { migrate } from './migrations';

export const DATABASE_NAME = 'fitfreak.db';

// Children render only after migrations finish, so screens can assume the schema exists.
export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      {children}
    </SQLiteProvider>
  );
}
