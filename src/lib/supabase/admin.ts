import { createClient } from "@supabase/supabase-js";

import { env, hasSupabaseAdmin } from "@/lib/env";
import { Database } from "@/lib/supabase/types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (!hasSupabaseAdmin) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return adminClient;
}
