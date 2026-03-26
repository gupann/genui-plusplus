import {
  getSupabaseClient,
  hasSupabaseClientConfig,
} from './supabaseClient';

export const PARTICIPANT_STORAGE_KEY = 'genreui_study_participant_id';

function createLocalParticipantId() {
  if (typeof window === 'undefined') return '';
  return `p_${crypto.randomUUID()}`;
}

export function getOrCreateLocalParticipantId() {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
  if (existing) return existing;
  const generated = createLocalParticipantId();
  window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, generated);
  return generated;
}

export async function getCurrentParticipant() {
  if (!hasSupabaseClientConfig()) {
    return { participantId: getOrCreateLocalParticipantId(), email: '' };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  return {
    participantId: session.user.id,
    email: session.user.email || '',
  };
}

export async function sendMagicLink(email, emailRedirectTo) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not configured.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) throw error;
}

export function subscribeAuthStateChange(onChange) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id) {
      onChange({
        participantId: session.user.id,
        email: session.user.email || '',
      });
    } else {
      onChange(null);
    }
  });
  return () => {
    data?.subscription?.unsubscribe?.();
    data?.unsubscribe?.();
  };
}

export async function signOutAndResetLocalState() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
    window.localStorage.removeItem('sb-localhost-auth-token');
    window.sessionStorage.clear();
  }
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
}
