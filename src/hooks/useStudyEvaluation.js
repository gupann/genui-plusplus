import { useEffect, useState } from 'react';

function isRecordedOutcome(value) {
  return (
    value === true ||
    value === false ||
    value === 'passed' ||
    value === 'partially_passed' ||
    value === 'failed'
  );
}

export function useStudyEvaluation({
  phase,
  changes,
  currentIndex,
  availableProviders,
  currentResult = {},
  initialSuccessById = {},
  initialNotSuccessById = {},
  initialApprovalsByProvider = {},
  initialRankingById = {},
  initialActiveProviderId = '',
}) {
  const [successById, setSuccessById] = useState(initialSuccessById);
  const [notSuccessById, setNotSuccessById] = useState(initialNotSuccessById);
  const [approvalsByProvider, setApprovalsByProvider] = useState(
    initialApprovalsByProvider,
  );
  const [rankingById, setRankingById] = useState(initialRankingById);
  const [activeProviderId, setActiveProviderId] = useState(
    initialActiveProviderId,
  );

  const currentChange = changes[currentIndex];
  const currentChangeId = currentChange?.id;
  const providersForChange = availableProviders;
  const hasRenderableOutput = (providerId) => {
    const providerState = currentResult?.[providerId];
    if (!providerState || providerState.error) return false;
    const result = providerState.result;
    if (!result) return false;
    return Boolean(result.afterImageUrl || result.afterHtml || result.afterCode);
  };

  const requiredProvidersForChange = providersForChange.filter((provider) =>
    hasRenderableOutput(provider.id),
  );
  const ranksToShow = requiredProvidersForChange.length || 0;

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

  function updateRanking(changeId, providerId, rank) {
    setRankingById((prev) => ({
      ...prev,
      [changeId]: { ...(prev[changeId] || {}), [providerId]: rank },
    }));
  }

  const approvalsComplete =
    requiredProvidersForChange.length === 0 ||
    requiredProvidersForChange.every((p) =>
      isRecordedOutcome(approvalsByProvider[currentChangeId]?.[p.id]),
    );

  const rankingCurrent = rankingById[currentChangeId] || {};
  const providerIds = requiredProvidersForChange.map((p) => p.id);
  const getAssignedRank = (providerId) => {
    if (rankingCurrent[providerId]) return rankingCurrent[providerId];
    // Legacy shape support (rank -> providerId)
    const legacyRankKey = Object.keys(rankingCurrent).find(
      (rank) => rankingCurrent[rank] === providerId,
    );
    return legacyRankKey || '';
  };
  const assignedRanks = providerIds
    .map((providerId) => Number(getAssignedRank(providerId)))
    .filter((value) => Number.isFinite(value) && value > 0);
  const uniqueSortedRanks = Array.from(new Set(assignedRanks)).sort(
    (a, b) => a - b,
  );
  const denseRankShapeValid = uniqueSortedRanks.every(
    (rank, index) => rank === index + 1,
  );
  const rankingComplete =
    ranksToShow === 0 ||
    (providerIds.length > 0 &&
      providerIds.every((providerId) => Boolean(getAssignedRank(providerId))) &&
      denseRankShapeValid);

  // Old strict no-ties validation (kept here for easy rollback):
  // const rankingValues = Array.from(
  //   { length: ranksToShow },
  //   (_, i) => rankingCurrent[i + 1],
  // ).filter(Boolean);
  // const uniqueRankCount = new Set(rankingValues).size;
  // const rankingComplete =
  //   ranksToShow === 0 ||
  //   (rankingValues.length === ranksToShow && uniqueRankCount === ranksToShow);

  const hasTextForProvider = (map, changeId, providerId) => {
    const entries = Array.isArray(map?.[changeId]) ? map[changeId] : [];
    return entries.some(
      (e) => e?.providerId === providerId && String(e?.text || '').trim(),
    );
  };

  const successComplete =
    requiredProvidersForChange.length > 0 &&
    requiredProvidersForChange.every((p) =>
      hasTextForProvider(successById, currentChangeId, p.id),
    );
  const failureComplete =
    requiredProvidersForChange.length > 0 &&
    requiredProvidersForChange.every((p) =>
      hasTextForProvider(notSuccessById, currentChangeId, p.id),
    );
  const feedbackComplete =
    requiredProvidersForChange.length === 0 ||
    requiredProvidersForChange.every((p) => {
      const hasSuccess = hasTextForProvider(successById, currentChangeId, p.id);
      const hasFailure = hasTextForProvider(
        notSuccessById,
        currentChangeId,
        p.id,
      );
      return hasSuccess || hasFailure;
    });

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
    requiredProvidersForChange,
    ranksToShow,
    scopedSuccess,
    scopedFailure,
    approvalsComplete,
    rankingComplete,
    feedbackComplete,
    successComplete,
    failureComplete,
    setSuccessById,
    setNotSuccessById,
    setApprovalsByProvider,
    setRankingById,
    setActiveProviderId,
    addEntryForProvider,
    removeEntryForProvider,
    updateEntry,
    setProviderApproval,
    updateRanking,
  };
}
