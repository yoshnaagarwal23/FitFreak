import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { getSetting, setSetting } from '@/db/settings';
import { DEFAULT_UNITS, type UnitSystem } from '@/lib/units';

const KEY = 'units';

type UnitsContextValue = { units: UnitSystem; setUnits: (u: UnitSystem) => Promise<void> };

const UnitsContext = createContext<UnitsContextValue>({ units: DEFAULT_UNITS, setUnits: async () => {} });

// Loads the saved unit system once and shares it app-wide. Must sit inside DatabaseProvider.
export function UnitsProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [units, setState] = useState<UnitSystem>(DEFAULT_UNITS);

  useEffect(() => {
    getSetting(db, KEY).then((v) => {
      if (v === 'metric' || v === 'imperial') setState(v);
    });
  }, [db]);

  const setUnits = useCallback(
    async (u: UnitSystem) => {
      setState(u);
      await setSetting(db, KEY, u);
    },
    [db],
  );

  return <UnitsContext.Provider value={{ units, setUnits }}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  return useContext(UnitsContext);
}
