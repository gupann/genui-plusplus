import { useEffect, useState } from 'react';
import { getProviderStatus } from '../services/api';
import { PROVIDERS } from '../constants/providers';

export function useProviderCatalog() {
  const [providerStatus, setProviderStatus] = useState({
    loading: true,
    error: null,
    providers: null,
    mode: 'unknown',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const status = await getProviderStatus();
        if (cancelled) return;
        setProviderStatus({
          loading: false,
          error: null,
          providers: status.providers || null,
          mode: status.mode || 'unknown',
        });
      } catch (err) {
        if (cancelled) return;
        setProviderStatus({
          loading: false,
          error: err.message || 'Unable to reach generation server.',
          providers: null,
          mode: 'unknown',
        });
      }
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableProviders = providerStatus?.providers
    ? PROVIDERS.filter((p) => providerStatus.providers[p.id]?.available !== false)
    : PROVIDERS;
  const missingProviders = providerStatus?.providers
    ? PROVIDERS.filter((p) => providerStatus.providers[p.id]?.available === false)
    : [];

  return {
    providerStatus,
    availableProviders,
    missingProviders,
  };
}
