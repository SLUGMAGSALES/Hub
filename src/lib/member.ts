import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamMember } from "@/lib/types";

/**
 * Returns the slug_team_members row for the currently authenticated user,
 * creating it on first login if it does not yet exist.
 *
 * Provisioning uses the SERVER-ONLY admin client because the RLS insert policy
 * requires `auth_user_id = auth.uid()`, and inserting the very first profile
 * row for a brand-new user is a trusted server operation. This is the single
 * justified use of the service role key in this app.
 */
export async function getOrCreateCurrentMember(): Promise<TeamMember | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fast path: profile already exists (read under RLS with the user session).
  const { data: existing } = await supabase
    .from("slug_team_members")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) return existing as TeamMember;

  // First login: provision the profile with the admin client.
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Unnamed rep";

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("slug_team_members")
    .upsert(
      {
        auth_user_id: user.id,
        email: user.email ?? "",
        full_name: fullName,
      },
      { onConflict: "auth_user_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("Failed to provision team member:", error.message);
    return null;
  }

  return created as TeamMember;
}
