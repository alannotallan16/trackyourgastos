import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, serviceRoleKey } from "@/lib/env";

/**
 * Service-role client. SERVER ONLY. Never import from a client component.
 * Used exclusively by the token-gated public invoice route handlers, which
 * authorize by possession of an unguessable token (not a user session).
 */
export function createServiceClient() {
  return createClient(SUPABASE_URL, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
