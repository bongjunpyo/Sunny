import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
