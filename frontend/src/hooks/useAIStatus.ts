import { useEffect, useState } from 'react';
import { getAIStatus } from '../services/api';
import type { AIStatus } from '@/types';

// One request per page load; every AI button reads the same answer.
let statusPromise: Promise<AIStatus> | null = null;

function loadStatus(): Promise<AIStatus> {
  if (!statusPromise) {
    statusPromise = getAIStatus().catch((err) => {
      statusPromise = null; // retry on the next mount instead of caching the failure
      throw err;
    });
  }
  return statusPromise;
}

/** Returns the backend AI status, or null while loading or when it could not be read (AI hidden). */
export function useAIStatus(): AIStatus | null {
  const [status, setStatus] = useState<AIStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
