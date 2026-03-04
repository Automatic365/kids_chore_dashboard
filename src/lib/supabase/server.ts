import { createClient } from "@supabase/supabase-js";

import { env, hasSupabaseClient } from "@/lib/env";
import { Database } from "@/lib/supabase/types";

export function getSupabaseServerClient() {
  if (!hasSupabaseClient) {
    return null;
  }

  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });
}
