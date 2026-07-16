// ======================================
// Vacatory
// Supabase Configuration
// ======================================

const SUPABASE_URL =
"https://qusyglgevgyjaoasmjhz.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_9ty8SXkUWakdGnSSWt3WeA_8TgRQY8x";

const client = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
