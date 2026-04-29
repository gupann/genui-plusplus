function toQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

async function parseJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}

export async function loadStudySession({
  participantId,
  email,
  iterationId,
  stageId,
  taskId,
}) {
  const normalizedIterationId = iterationId ?? stageId;
  const query = toQuery({
    participantId,
    email,
    iterationId: normalizedIterationId,
    // Backward compatibility with older backend/query readers.
    stageId: normalizedIterationId,
    taskId,
  });
  const response = await fetch(`/api/session/load${query}`);
  return parseJson(response);
}

export async function listStudySessions({
  participantId,
  iterationId,
  stageId,
}) {
  const normalizedIterationId = iterationId ?? stageId;
  const query = toQuery({
    participantId,
    iterationId: normalizedIterationId,
    stageId: normalizedIterationId,
  });
  const response = await fetch(`/api/session/list${query}`);
  return parseJson(response);
}

export async function startStudySession({
  participantId,
  email,
  iterationId,
  stageId,
  taskId,
  snapshot,
}) {
  const normalizedIterationId = iterationId ?? stageId;
  const response = await fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId,
      email,
      iterationId: normalizedIterationId,
      // Backward compatibility with older backend readers.
      stageId: normalizedIterationId,
      taskId,
      snapshot,
    }),
  });
  return parseJson(response);
}

export async function saveStudySession({ sessionId, snapshot, status }) {
  const response = await fetch('/api/session/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, snapshot, status }),
  });
  return parseJson(response);
}

export async function completeStudySession({ sessionId, snapshot }) {
  const response = await fetch('/api/session/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, snapshot }),
  });
  return parseJson(response);
}

export async function upsertParticipantProfile({
  participantId,
  email,
  profile,
}) {
  const response = await fetch('/api/participant/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, email, profile }),
  });
  return parseJson(response);
}

export async function loadParticipantProfile({ participantId, email }) {
  const query = toQuery({ participantId, email });
  const response = await fetch(`/api/participant/profile${query}`);
  return parseJson(response);
}
