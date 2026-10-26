import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { getUserSettings, updateUserSettings } from '@/db/settings';
import { useDb } from '@/db/supabase';
import { DEFAULT_UNITS, type UnitSystem } from '@/lib/units';

type UnitsContextValue = { units: UnitSystem; setUnits: (u: UnitSystem) => Promise<void> };

const UnitsContext = createContext<UnitsContextValue>({ units: DEFAULT_UNITS, setUnits: async () => {} });

// Loads the saved unit system once and shares it app-wide.
export function UnitsProvider({ children }: PropsWithChildren) {
  const db = useDb();
  const [units, setState] = useState<UnitSystem>(DEFAULT_UNITS);

  useEffect(() => {
    getUserSettings(db)
      .then((s) => {
        if (s) setState(s.units);
      })
      .catch(() => {}); // signed out, or offline: keep the default
  }, [db]);

  const setUnits = useCallback(
    async (u: UnitSystem) => {
      setState(u);
      await updateUserSettings(db, { units: u });
    },
    [db],
  );

  return <UnitsContext.Provider value={{ units, setUnits }}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  return useContext(UnitsContext);
}
