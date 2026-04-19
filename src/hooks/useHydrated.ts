import { useState, useEffect } from 'react';

export function useHydrated<T>(store: () => T, fallback: T): T {
  const [hydrated, setHydrated] = useState(false);
  const storeValue = store();

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated ? storeValue : fallback;
}
