import { useEffect, useState } from 'react';

export function useStudyEvaluation({
  phase,
  changes,
  currentIndex,
  availableProviders,
}) {
  const [successById, setSuccessById] = useState({});
  const [notSuccessById, setNotSuccessById] = useState({});
  const [approvalsByProvider, setApprovalsByProvider] = useState({});
  const [rankingById, setRankingById] = useState({});
  const [activeProviderId, setActiveProviderId] = useState('');

  const currentChange = changes[currentIndex];
  const currentChangeId = currentChange?.id;
  const providersForChange = availableProviders;
  const ranksToShow = providersForChange.length || 0;

  useEffect(() => {
    if (!activeProviderId && availableProviders.length) {
      setActiveProviderId(availableProviders[0].id);
      return;
    }
    if (
      activeProviderId &&
      availableProviders.length &&
      !availableProviders.some((p) => p.id === activeProviderId)
    ) {
      setActiveProviderId(availableProviders[0].id);
    }
  }, [activeProviderId, availableProviders]);

  useEffect(() => {
    if (phase !== 'review') return;
    const changeId = changes[currentIndex]?.id;
    if (!changeId) return;
    const providerIds = (availableProviders || []).map((p) => p.id);
    if (!providerIds.length) return;

    const ensure = (setter) => {
      setter((prev) => {
        const existing = Array.isArray(prev[changeId]) ? [...prev[changeId]] : [];
        const nextEntries = [...existing];
        providerIds.forEach((providerId) => {
          let countForProvider = nextEntries.filter(
            (e) => e?.providerId === providerId,
          ).length;
          while (countForProvider < 3) {
            nextEntries.push({ text: '', providerId });
            countForProvider += 1;
          }
        });
        return { ...prev, [changeId]: nextEntries };
      });
    };

    ensure(setSuccessById);
    ensure(setNotSuccessById);
  }, [phase, currentIndex, changes, availableProviders]);

  function updateEntry(setter, changeId, index, key, value) {
    setter((prev) => {
      const next = { ...prev };
      const entries = Array.isArray(next[changeId])
        ? [...next[changeId]]
        : [{ text: '', providerId: '' }];
      while (entries.length <= index) {
        entries.push({ text: '', providerId: '' });
      }
      entries[index] = { ...entries[index], [key]: value };
      next[changeId] = entries;
      return next;
    });
  }

  function getScopedEntries(map, changeId, providerId) {
    const entries = Array.isArray(map[changeId]) ? map[changeId] : [];
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry?.providerId === providerId);
  }

  function addEntryForProvider(setter, changeId, providerId) {
    setter((prev) => {
      const next = { ...prev };
      const entries = Array.isArray(next[changeId]) ? [...next[changeId]] : [];
      entries.push({ text: '', providerId });
      next[changeId] = entries;
      return next;
    });
  }

  function removeEntryForProvider(setter, changeId, providerId, globalIndex) {
    setter((prev) => {
      const next = { ...prev };
      const entries = Array.isArray(next[changeId]) ? [...next[changeId]] : [];
      const countForProvider = entries.filter((e) => e?.providerId === providerId)
        .length;
      if (countForProvider <= 1) return prev;
      entries.splice(globalIndex, 1);
      next[changeId] = entries.length ? entries : [{ text: '', providerId }];
      return next;
    });
  }

  function setProviderApproval(changeId, providerId, value) {
    setApprovalsByProvider((prev) => ({
      ...prev,
      [changeId]: { ...(prev[changeId] || {}), [providerId]: value },
    }));
  }

  function updateRanking(changeId, slot, providerId) {
    setRankingById((prev) => ({
      ...prev,
      [changeId]: { ...(prev[changeId] || {}), [slot]: providerId },
    }));
  }

  const approvalsComplete =
    providersForChange.length > 0 &&
    providersForChange.every(
      (p) =>
        approvalsByProvider[currentChangeId]?.[p.id] === true ||
        approvalsByProvider[currentChangeId]?.[p.id] === false,
    );

  const rankingCurrent = rankingById[currentChangeId] || {};
  const rankingValues = Array.from({ length: ranksToShow }, (_, i) => rankingCurrent[i + 1]).filter(Boolean);
  const uniqueRankCount = new Set(rankingValues).size;
  const rankingComplete =
    ranksToShow === 0 ||
    (rankingValues.length === ranksToShow && uniqueRankCount === ranksToShow);

  const hasTextForProvider = (map, changeId, providerId) => {
    const entries = Array.isArray(map?.[changeId]) ? map[changeId] : [];
    return entries.some(
      (e) => e?.providerId === providerId && String(e?.text || '').trim(),
    );
  };

  const successComplete =
    providersForChange.length > 0 &&
    providersForChange.every((p) =>
      hasTextForProvider(successById, currentChangeId, p.id),
    );
  const failureComplete =
    providersForChange.length > 0 &&
    providersForChange.every((p) =>
      hasTextForProvider(notSuccessById, currentChangeId, p.id),
    );

  const activeProvider =
    providersForChange.find((p) => p.id === activeProviderId) ||
    providersForChange[0] ||
    null;

  const scopedSuccess = activeProvider
    ? getScopedEntries(successById, currentChangeId, activeProvider.id)
    : [];
  const scopedFailure = activeProvider
    ? getScopedEntries(notSuccessById, currentChangeId, activeProvider.id)
    : [];

  return {
    successById,
    notSuccessById,
    approvalsByProvider,
    rankingById,
    activeProvider,
    providersForChange,
    ranksToShow,
    scopedSuccess,
    scopedFailure,
    approvalsComplete,
    rankingComplete,
    successComplete,
    failureComplete,
    setSuccessById,
    setNotSuccessById,
    setActiveProviderId,
    addEntryForProvider,
    removeEntryForProvider,
    updateEntry,
    setProviderApproval,
    updateRanking,
  };
}
