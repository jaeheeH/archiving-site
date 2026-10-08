import { createClient } from '@supabase/supabase-js';

export function createAdminClient(options: { timeoutMs?: number } = {}) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      ...(options.timeoutMs ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(options.timeoutMs!)]) : AbortSignal.timeout(options.timeoutMs!) }) } } : {}),
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
