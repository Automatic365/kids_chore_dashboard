"use client";

import { createClient } from "@supabase/supabase-js";

import { env, hasSupabaseClient } from "@/lib/env";
import { Database } from "@/lib/supabase/types";

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (!hasSupabaseClient) {
    return null;
  }

  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }

  return client;
}
