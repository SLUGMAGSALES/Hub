import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  /** Display name derived from the email local-part (no team_members table yet). */
  name: string;
};

/**
 * Returns the currently authenticated user, or null.
 *
 * There is no team_members table in the live schema, so we identify reps by
 * their auth email. `logged_by` (activities) and `assigned_to` (leads/contacts)
 * are stored as this email string for now — a team_members table can be
 * introduced later without changing callers much.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email.split("@")[0];

  return { id: user.id, email: user.email, name };
}
