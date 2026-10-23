import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { referenceSql } from '../scripts/gen-reference-sql.mts';

// The committed Supabase migration must match what the seed files generate today.
const committed = readFileSync(
  new URL('../supabase/migrations/20261022000003_reference_data.sql', import.meta.url),
  'utf8',
);
assert.equal(
  committed,
  referenceSql(),
  'Reference data migration is stale — regenerate it with scripts/gen-reference-sql.mts',
);
console.log('reference data migration matches seed files: OK');
