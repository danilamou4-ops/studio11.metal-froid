'use client';

import { useEffect, useState } from 'react';

type TeamRole = 'admin' | 'member' | null;

export function useTeamRole() {
  const [role, setRole] = useState<TeamRole>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      try {
        const response = await fetch('/api/account/team-role', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data?: { role?: TeamRole } };
        if (active) {
          setRole(payload.data?.role ?? null);
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, []);

  return {
    role,
    loaded,
    isAdmin: role === 'admin',
  };
}