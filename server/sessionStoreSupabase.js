import { getSupabaseAdminClient } from './supabaseAdmin.js';

function mapSession(row, snapshot) {
  if (!row) return null;
  return {
    id: row.id,
    participantId: row.participant_id,
    stageId: row.stage_id,
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

export async function findSession({ participantId, stageId, taskId }) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('participant_id', participantId)
    .eq('stage_id', Number(stageId))
    .eq('task_id', Number(taskId))
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const snapshot = await getSnapshotBySessionId(supabase, data.id);
  return mapSession(data, snapshot);
}

export async function createSession({
  participantId,
  stageId,
  taskId,
  snapshot,
  status = 'in_progress',
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      participant_id: participantId,
      stage_id: Number(stageId),
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

  return mapSession(data, snapshot || {});
}
