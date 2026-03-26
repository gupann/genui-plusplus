import { createClient } from '@supabase/supabase-js';

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

export function hasSupabaseAdminConfig() {
  const { url, serviceRoleKey } = getConfig();
  return Boolean(url && serviceRoleKey);
}

let cachedClient = null;
let cachedSignature = '';

export function getSupabaseAdminClient() {
  const { url, serviceRoleKey } = getConfig();
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
    );
  }
  const signature = `${url}::${serviceRoleKey.slice(0, 16)}`;
  if (cachedClient && cachedSignature === signature) return cachedClient;
  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cachedSignature = signature;
  return cachedClient;
}
