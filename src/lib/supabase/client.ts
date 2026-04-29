import { createBrowserClient } from "@supabase/ssr";

import { readPublicEnv } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = readPublicEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
