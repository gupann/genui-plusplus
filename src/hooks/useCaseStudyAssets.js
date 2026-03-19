import { useEffect, useState } from 'react';

function getBeforeImageUrl(taskId) {
  return `/case-study-${taskId}/task${taskId}-before.png`;
}

function getBeforeCodeUrl(taskId) {
  return `/case-study-${taskId}/task${taskId}-before.html`;
}

export function useCaseStudyAssets(taskId) {
  const [beforeCode, setBeforeCode] = useState('');
  const [beforeImageFailed, setBeforeImageFailed] = useState(false);

  const beforeImageUrl = getBeforeImageUrl(taskId);
  const beforeCodeUrl = getBeforeCodeUrl(taskId);

  useEffect(() => {
    let cancelled = false;

    async function loadBeforeCode() {
      try {
        const response = await fetch(beforeCodeUrl);
        if (!response.ok) throw new Error('missing before code');
        const text = await response.text();
        if (!cancelled) setBeforeCode(text);
      } catch {
        if (!cancelled) setBeforeCode('');
      }
    }

    loadBeforeCode();

    return () => {
      cancelled = true;
    };
  }, [beforeCodeUrl]);

  return {
    beforeCode,
    beforeCodeUrl,
    beforeImageUrl,
    beforeImageFailed,
    setBeforeImageFailed,
  };
}
