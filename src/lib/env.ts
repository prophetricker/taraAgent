type EnvRecord = Record<string, string | undefined>;

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_CHAT_MODEL"
] as const;

export type ServerEnv = {
  supabase: {
    url: string;
    anonKey: string;
  };
  databaseUrl: string;
  ai: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
};

export function readServerEnv(env: EnvRecord = process.env): ServerEnv {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return {
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    },
    databaseUrl: env.DATABASE_URL!,
    ai: {
      apiKey: env.AI_API_KEY!,
      baseUrl: env.AI_BASE_URL!,
      model: env.AI_CHAT_MODEL!
    }
  };
}

export function readPublicEnv(env: EnvRecord = process.env) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing public Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}
