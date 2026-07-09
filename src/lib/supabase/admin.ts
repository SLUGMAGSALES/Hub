import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY admin client.
 *
 * The `import "server-only"` above makes the build FAIL if this module is ever
 * imported into a client component — that is the guardrail that keeps the
 * service role key off the browser.
 *
 * The service role key bypasses Row Level Security, so use this client
 * sparingly and only for trusted server-side operations (e.g. provisioning a
 * rep's profile row on first login). Never expose its results directly to an
 * unauthenticated caller.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required for server-side " +
        "provisioning and must be configured as a server-only env var.",
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
