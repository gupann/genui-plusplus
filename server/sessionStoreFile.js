import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultDbPath = path.join(projectRoot, '.data', 'study-sessions.json');
const serverlessDbPath = '/tmp/study-sessions.json';
const DB_PATH =
  process.env.STUDY_DB_PATH ||
  (process.env.VERCEL ? serverlessDbPath : defaultDbPath);

const EMPTY_DB = {
  participants: {},
  profiles: {},
  sessions: {},
};

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(DB_PATH, 'utf8');
  } catch {
    await writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
  }
}

async function readDb() {
  await ensureDbFile();
  const raw = await readFile(DB_PATH, 'utf8');
  if (!raw.trim()) return clone(EMPTY_DB);
  try {
    const parsed = JSON.parse(raw);
    return {
      participants: parsed.participants || {},
      profiles: parsed.profiles || {},
      sessions: parsed.sessions || {},
    };
  } catch {
    return clone(EMPTY_DB);
  }
}

async function writeDb(db) {
  await ensureDbFile();
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function buildSessionRecord({
  id,
  participantId,
  stageId,
  taskId,
  status,
  snapshot,
  createdAt,
}) {
  const timestamp = createdAt || nowIso();
  return {
    id,
    participantId,
    stageId,
    taskId,
    status: status || 'in_progress',
    snapshot: snapshot || {},
    startedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

export async function upsertParticipant({
  participantId,
  email = '',
  metadata = {},
}) {
  if (!participantId) throw new Error('participantId is required');
  const db = await readDb();
  const existing = db.participants[participantId];
  const participant = existing
    ? {
        ...existing,
        email: email || existing.email || '',
        metadata: {
          ...(existing.metadata || {}),
          ...(metadata || {}),
        },
        updatedAt: nowIso(),
      }
    : {
        id: participantId,
        email: email || '',
        metadata: metadata || {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

  db.participants[participantId] = participant;
  await writeDb(db);
  return clone(participant);
}

export async function upsertParticipantProfile({ participantId, profile }) {
  if (!participantId) throw new Error('participantId is required');
  const db = await readDb();
  db.profiles[participantId] = {
    ...(db.profiles[participantId] || {}),
    ...(profile || {}),
    participantId,
    updatedAt: nowIso(),
  };
  await writeDb(db);
  return clone(db.profiles[participantId]);
}

export async function getParticipantProfile({ participantId }) {
  if (!participantId) throw new Error('participantId is required');
  const db = await readDb();
  const profile = db.profiles[participantId];
  if (!profile) return null;
  return clone(profile);
}

export async function findSession({ participantId, stageId, taskId }) {
  const db = await readDb();
  const sessions = Object.values(db.sessions || {}).filter((session) => {
    return (
      session.participantId === participantId &&
      Number(session.stageId) === Number(stageId) &&
      Number(session.taskId) === Number(taskId)
    );
  });
  if (!sessions.length) return null;
  sessions.sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
  return clone(sessions[0]);
}

export async function createSession({
  participantId,
  stageId,
  taskId,
  snapshot,
  status = 'in_progress',
}) {
  if (!participantId) throw new Error('participantId is required');
  const db = await readDb();
  const sessionId = `sess_${crypto.randomUUID()}`;
  const session = buildSessionRecord({
    id: sessionId,
    participantId,
    stageId,
    taskId,
    status,
    snapshot,
  });
  db.sessions[sessionId] = session;
  await writeDb(db);
  return clone(session);
}

export async function saveSession({ sessionId, snapshot, status }) {
  if (!sessionId) throw new Error('sessionId is required');
  const db = await readDb();
  const existing = db.sessions[sessionId];
  if (!existing) throw new Error('Session not found');
  const next = {
    ...existing,
    snapshot: snapshot || existing.snapshot || {},
    status: status || existing.status || 'in_progress',
    updatedAt: nowIso(),
  };
  db.sessions[sessionId] = next;
  await writeDb(db);
  return clone(next);
}

export async function completeSession({ sessionId, snapshot }) {
  if (!sessionId) throw new Error('sessionId is required');
  const db = await readDb();
  const existing = db.sessions[sessionId];
  if (!existing) throw new Error('Session not found');
  const timestamp = nowIso();
  const next = {
    ...existing,
    snapshot: snapshot || existing.snapshot || {},
    status: 'completed',
    updatedAt: timestamp,
    completedAt: timestamp,
  };
  db.sessions[sessionId] = next;
  await writeDb(db);
  return clone(next);
}
