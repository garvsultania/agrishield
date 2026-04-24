'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/**
 * Reflect an optional `?farm=<id>` query param into state for deep-linking
 * the farm-detail drawer. Updates replace the URL without adding history entries.
 */
export function useFarmUrlSync(): {
  selectedFarmId: string | null;
  openFarm: (farmId: string) => void;
  closeFarm: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('farm');

  const openFarm = React.useCallback(
    (farmId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('farm', farmId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const closeFarm = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('farm');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return { selectedFarmId: current, openFarm, closeFarm };
}
