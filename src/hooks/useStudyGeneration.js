import { useState } from 'react';
import { generateAfterScreen } from '../services/api';

const CLIENT_WATCHDOG_MS = 50000;

export function useStudyGeneration({
  taskId,
  changes,
  currentIndex,
  beforeImageUrl,
  beforeCode,
  initialResultsById = {},
}) {
  const [resultsById, setResultsById] = useState(initialResultsById);
  const [iframeHeightsById, setIframeHeightsById] = useState({});

  function triggerProviderGeneration(providerId, { force = false } = {}) {
    const current = changes[currentIndex];
    if (!current) return;
    const changeId = current.id;
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setResultsById((prev) => {
      const existingForChange = prev[changeId] || {};
      const existingProvider = existingForChange[providerId];
      if (!force && (existingProvider?.loading || existingProvider?.done)) {
        return prev;
      }
      return {
        ...prev,
        [changeId]: {
          ...existingForChange,
          [providerId]: {
            ...(existingProvider || {}),
            loading: true,
            error: null,
            requestId,
            startedAt: Date.now(),
          },
        },
      };
    });

    setTimeout(() => {
      setResultsById((prev) => {
        const currentProvider = prev?.[changeId]?.[providerId];
        if (!currentProvider?.loading) return prev;
        if (currentProvider.requestId !== requestId) return prev;
        return {
          ...prev,
          [changeId]: {
            ...(prev[changeId] || {}),
            [providerId]: {
              ...(currentProvider || {}),
              loading: false,
              done: true,
              error: 'Request timed out or was blocked. Try again.',
            },
          },
        };
      });
    }, CLIENT_WATCHDOG_MS);

    const run = async () => {
      try {
        const result = await generateAfterScreen({
          taskId,
          prompt: current.problem,
          beforeImageUrl,
          beforeCode,
          provider: providerId,
        });
        setResultsById((prev) => ({
          ...prev,
          [changeId]: {
            ...(prev[changeId] || {}),
            [providerId]: {
              ...(prev[changeId]?.[providerId] || {}),
              loading: false,
              done: true,
              result,
            },
          },
        }));
      } catch (err) {
        setResultsById((prev) => ({
          ...prev,
          [changeId]: {
            ...(prev[changeId] || {}),
            [providerId]: {
              ...(prev[changeId]?.[providerId] || {}),
              loading: false,
              done: true,
              error: err.message || 'Failed to generate screen.',
            },
          },
        }));
      }
    };

    run();
  }

  function getIframeHeight(changeId, providerId) {
    return iframeHeightsById[changeId]?.[providerId] || 900;
  }

  function handleIframeLoad(changeId, providerId, event) {
    try {
      const doc = event.target?.contentDocument;
      if (!doc) return;
      const height =
        doc.documentElement?.scrollHeight ||
        doc.body?.scrollHeight ||
        doc.documentElement?.offsetHeight ||
        900;
      setIframeHeightsById((prev) => {
        const next = { ...prev };
        const entry = { ...(next[changeId] || {}) };
        entry[providerId] = Math.max(height, 600);
        next[changeId] = entry;
        return next;
      });
    } catch {
      // no-op for iframe read edge cases
    }
  }

  return {
    resultsById,
    setResultsById,
    triggerProviderGeneration,
    getIframeHeight,
    handleIframeLoad,
  };
}
