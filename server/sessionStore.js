import { hasSupabaseAdminConfig } from './supabaseAdmin.js';
import * as fileStore from './sessionStoreFile.js';
import * as supabaseStore from './sessionStoreSupabase.js';

function getStore() {
  return hasSupabaseAdminConfig() ? supabaseStore : fileStore;
}

export async function upsertParticipant(args) {
  const store = getStore();
  return store.upsertParticipant(args);
}

export async function upsertParticipantProfile(args) {
  const store = getStore();
  return store.upsertParticipantProfile(args);
}

export async function getParticipantProfile(args) {
  const store = getStore();
  if (typeof store.getParticipantProfile === 'function') {
    return store.getParticipantProfile(args);
  }
  return null;
}

export async function findSession(args) {
  const store = getStore();
  return store.findSession(args);
}

export async function listSessions(args) {
  const store = getStore();
  if (typeof store.listSessions === 'function') {
    return store.listSessions(args);
  }
  return [];
}

export async function createSession(args) {
  const store = getStore();
  return store.createSession(args);
}

export async function saveSession(args) {
  const store = getStore();
  return store.saveSession(args);
}

export async function completeSession(args) {
  const store = getStore();
  return store.completeSession(args);
}
