import { createBrowserClient } from "@supabase/ssr";

// Browser client. Same anon key and RLS rules as the server; used for direct file uploads.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
