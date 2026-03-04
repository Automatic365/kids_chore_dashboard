export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  parentSessionSecret:
    process.env.PARENT_SESSION_SECRET ?? "herohabits-dev-session-secret",
  parentPinPepper: process.env.PARENT_PIN_PEPPER ?? "herohabits-dev-pepper",
  parentPinHash: process.env.PARENT_PIN_HASH ?? "",
  parentPinPlain: process.env.PARENT_PIN_PLAIN ?? "1234",
  internalCronSecret:
    process.env.INTERNAL_CRON_SECRET ?? "herohabits-dev-cron-secret",
  appTimeZone: process.env.APP_TIME_ZONE ?? "America/Chicago",
};

export const hasSupabaseAdmin =
  env.supabaseUrl.length > 0 && env.supabaseServiceRoleKey.length > 0;

export const hasSupabaseClient =
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
