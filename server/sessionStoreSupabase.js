import { getSupabaseAdminClient } from './supabaseAdmin.js';

function mapSession(row, snapshot) {
  if (!row) return null;
  const normalizedIterationId = row.iteration_id ?? row.stage_id;
  return {
    id: row.id,
    participantId: row.participant_id,
    iterationId: normalizedIterationId,
    // Backward compatibility with older frontend readers.
    stageId: normalizedIterationId,
    taskId: row.task_id,
    status: row.status,
    snapshot: snapshot || {},
    startedAt: row.started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

async function getSnapshotBySessionId(supabase, sessionId) {
  const { data, error } = await supabase
    .from('study_session_snapshots')
    .select('snapshot')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.snapshot || {};
}

function normalizeOutcome(value) {
  if (value === true || value === 'passed') return 'passed';
  if (value === false || value === 'failed') return 'failed';
  if (value === 'partially_passed') return 'partially_passed';
  return null;
}

function normalizeRank(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getFeedbackNotes(map, changeId, providerId) {
  const entries = Array.isArray(map?.[changeId]) ? map[changeId] : [];
  return entries
    .filter((entry) => entry?.providerId === providerId)
    .map((entry) => String(entry?.text || '').trim())
    .filter(Boolean);
}

async function materializeSessionArtifacts({ supabase, sessionRow, snapshot }) {
  if (!sessionRow?.id) return;

  const sessionId = sessionRow.id;
  const participantId = sessionRow.participant_id;
  const stageId = Number(sessionRow.iteration_id ?? sessionRow.stage_id);
  const taskId = Number(sessionRow.task_id);
  const changes = Array.isArray(snapshot?.changes) ? snapshot.changes : [];
  const resultsById = snapshot?.resultsById || {};
  const approvalsByProvider = snapshot?.approvalsByProvider || {};
  const rankingById = snapshot?.rankingById || {};
  const successById = snapshot?.successById || {};
  const notSuccessById = snapshot?.notSuccessById || {};
  const now = new Date().toISOString();

  const changeRows = changes.map((change, index) => ({
    session_id: sessionId,
    participant_id: participantId,
    stage_id: stageId,
    task_id: taskId,
    change_id: Number(change?.id),
    change_order: index + 1,
    issue_text: String(change?.problem || ''),
    updated_at: now,
  }));

  const outputRows = [];
  const evaluationRows = [];

  for (const change of changes) {
    const changeId = Number(change?.id);
    const providerStates = resultsById?.[changeId] || {};
    const evaluationProviderIds = new Set([
      ...Object.keys(approvalsByProvider?.[changeId] || {}),
      ...Object.keys(rankingById?.[changeId] || {}),
      ...((Array.isArray(successById?.[changeId]) ? successById[changeId] : [])
        .map((entry) => entry?.providerId)
        .filter(Boolean)),
      ...((Array.isArray(notSuccessById?.[changeId])
        ? notSuccessById[changeId]
        : [])
        .map((entry) => entry?.providerId)
        .filter(Boolean)),
    ]);

    for (const [providerId, providerState] of Object.entries(providerStates)) {
      const result = providerState?.result || {};
      outputRows.push({
        session_id: sessionId,
        participant_id: participantId,
        stage_id: stageId,
        task_id: taskId,
        change_id: changeId,
        provider_id: providerId,
        input_issue_text: String(change?.problem || ''),
        revision_prompt: String(result?.finalPrompt || ''),
        after_html: String(result?.afterHtml || result?.afterCode || ''),
        after_image_url: result?.afterImageUrl || null,
        output_status: providerState?.error
          ? 'error'
          : providerState?.loading
            ? 'loading'
            : result?.afterHtml || result?.afterCode || result?.afterImageUrl
              ? 'generated'
              : providerState?.done
                ? 'empty'
                : 'pending',
        error_text: providerState?.error || null,
        updated_at: now,
      });
    }

    for (const providerId of evaluationProviderIds) {
      evaluationRows.push({
        session_id: sessionId,
        participant_id: participantId,
        stage_id: stageId,
        task_id: taskId,
        change_id: changeId,
        provider_id: providerId,
        outcome: normalizeOutcome(approvalsByProvider?.[changeId]?.[providerId]),
        rank: normalizeRank(rankingById?.[changeId]?.[providerId]),
        success_notes: getFeedbackNotes(successById, changeId, providerId),
        failure_notes: getFeedbackNotes(notSuccessById, changeId, providerId),
        updated_at: now,
      });
    }
  }

  const deletions = [
    supabase.from('study_change_requests').delete().eq('session_id', sessionId),
    supabase
      .from('study_generation_outputs')
      .delete()
      .eq('session_id', sessionId),
    supabase
      .from('study_provider_evaluations')
      .delete()
      .eq('session_id', sessionId),
  ];

  for (const deletion of deletions) {
    const { error } = await deletion;
    if (error) throw new Error(error.message);
  }

  if (changeRows.length) {
    const { error } = await supabase.from('study_change_requests').insert(changeRows);
    if (error) throw new Error(error.message);
  }

  if (outputRows.length) {
    const { error } = await supabase
      .from('study_generation_outputs')
      .insert(outputRows);
    if (error) throw new Error(error.message);
  }

  if (evaluationRows.length) {
    const { error } = await supabase
      .from('study_provider_evaluations')
      .insert(evaluationRows);
    if (error) throw new Error(error.message);
  }
}

export async function upsertParticipant({
  participantId,
  email = '',
  metadata = {},
}) {
  if (!participantId) throw new Error('participantId is required');
  const supabase = getSupabaseAdminClient();
  const payload = {
    id: participantId,
    email: email || null,
    metadata: metadata || {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('participants')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    email: data.email || '',
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function upsertParticipantProfile({ participantId, profile }) {
  if (!participantId) throw new Error('participantId is required');
  const supabase = getSupabaseAdminClient();
  const payload = {
    participant_id: participantId,
    name: profile?.name || null,
    current_profession: profile?.currentProfession || null,
    past_work: profile?.pastWork || null,
    extra: profile?.extra || {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('participant_profiles')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return {
    participantId: data.participant_id,
    name: data.name || '',
    currentProfession: data.current_profession || '',
    pastWork: data.past_work || '',
    extra: data.extra || {},
    updatedAt: data.updated_at,
  };
}

export async function getParticipantProfile({ participantId }) {
  if (!participantId) throw new Error('participantId is required');
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('participant_profiles')
    .select('*')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    participantId: data.participant_id,
    name: data.name || '',
    currentProfession: data.current_profession || '',
    pastWork: data.past_work || '',
    extra: data.extra || {},
    updatedAt: data.updated_at,
  };
}

export async function findSession({ participantId, iterationId, stageId, taskId }) {
  const normalizedIterationId = Number(iterationId ?? stageId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('participant_id', participantId)
    .eq('stage_id', normalizedIterationId)
    .eq('task_id', Number(taskId))
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const snapshot = await getSnapshotBySessionId(supabase, data.id);
  return mapSession(data, snapshot);
}

export async function listSessions({ participantId, iterationId, stageId }) {
  if (!participantId) throw new Error('participantId is required');
  const normalizedIterationId =
    iterationId !== undefined || stageId !== undefined
      ? Number(iterationId ?? stageId)
      : null;
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('study_sessions')
    .select('*')
    .eq('participant_id', participantId)
    .order('updated_at', { ascending: false });

  if (normalizedIterationId !== null) {
    query = query.eq('stage_id', normalizedIterationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const sessions = await Promise.all(
    data.map(async (row) => {
      const snapshot = await getSnapshotBySessionId(supabase, row.id);
      return mapSession(row, snapshot);
    }),
  );
  return sessions;
}

export async function createSession({
  participantId,
  iterationId,
  stageId,
  taskId,
  snapshot,
  status = 'in_progress',
}) {
  const normalizedIterationId = Number(iterationId ?? stageId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      participant_id: participantId,
      stage_id: normalizedIterationId,
      task_id: Number(taskId),
      status,
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const { error: snapshotError } = await supabase
    .from('study_session_snapshots')
    .upsert({
      session_id: data.id,
      snapshot: snapshot || {},
      updated_at: new Date().toISOString(),
    });
  if (snapshotError) throw new Error(snapshotError.message);

  await materializeSessionArtifacts({
    supabase,
    sessionRow: data,
    snapshot: snapshot || {},
  });

  return mapSession(data, snapshot || {});
}

export async function saveSession({ sessionId, snapshot, status }) {
  const supabase = getSupabaseAdminClient();
  const updates = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  const { data, error } = await supabase
    .from('study_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const { error: snapshotError } = await supabase
    .from('study_session_snapshots')
    .upsert({
      session_id: sessionId,
      snapshot: snapshot || {},
      updated_at: new Date().toISOString(),
    });
  if (snapshotError) throw new Error(snapshotError.message);

  await materializeSessionArtifacts({
    supabase,
    sessionRow: data,
    snapshot: snapshot || {},
  });

  return mapSession(data, snapshot || {});
}

export async function completeSession({ sessionId, snapshot }) {
  const supabase = getSupabaseAdminClient();
  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('study_sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const { error: snapshotError } = await supabase
    .from('study_session_snapshots')
    .upsert({
      session_id: sessionId,
      snapshot: snapshot || {},
      updated_at: completedAt,
    });
  if (snapshotError) throw new Error(snapshotError.message);

  await materializeSessionArtifacts({
    supabase,
    sessionRow: data,
    snapshot: snapshot || {},
  });

  return mapSession(data, snapshot || {});
}
