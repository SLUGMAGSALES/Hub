"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateCurrentMember } from "@/lib/member";
import { STAGES, CONTACT_METHODS } from "@/lib/constants";

function backToLog(kind: "error" | "success", message: string) {
  redirect(`/log?${kind}=${encodeURIComponent(message)}`);
}

/**
 * Logs a single lead touch. Designed to be a ~45-second flow:
 *   1. find-or-create the lead by company name (owned by this rep if new)
 *   2. insert the activity record
 *   3. advance the lead's stage (only if this rep owns it)
 *   4. if a next follow-up date was given, close this rep's open follow-ups on
 *      the lead and create a fresh one — this is what powers the follow-up list
 * All writes run under the user's session, so RLS enforces rep-scoping.
 */
export async function logActivity(formData: FormData) {
  const member = await getOrCreateCurrentMember();
  if (!member) redirect("/login");

  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const contactMethod = String(formData.get("contact_method") ?? "").trim();
  const stage = String(formData.get("stage") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const nextFollowUp = String(formData.get("next_follow_up_date") ?? "").trim();

  if (!companyName) backToLog("error", "Company is required.");
  if (!CONTACT_METHODS.includes(contactMethod as never)) {
    backToLog("error", "Pick a valid contact method.");
  }
  const stageValue = STAGES.includes(stage as never) ? stage : "new";

  const supabase = createClient();

  // 1. Find-or-create the lead (exact, case-insensitive company match).
  const { data: found } = await supabase
    .from("slug_leads")
    .select("id, owner_id")
    .ilike("company_name", companyName)
    .limit(1)
    .maybeSingle();

  let leadId: string;
  let ownedByMe: boolean;

  if (found) {
    leadId = found.id as string;
    ownedByMe = found.owner_id === member.id;
  } else {
    const { data: created, error: leadErr } = await supabase
      .from("slug_leads")
      .insert({
        company_name: companyName,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        stage: stageValue,
        owner_id: member.id,
      })
      .select("id")
      .single();

    if (leadErr || !created) {
      backToLog("error", `Could not create lead: ${leadErr?.message ?? "unknown"}`);
    }
    leadId = created!.id as string;
    ownedByMe = true;
  }

  // 2. Insert the activity (authored by this rep).
  const { data: activity, error: actErr } = await supabase
    .from("slug_activities")
    .insert({
      lead_id: leadId,
      member_id: member.id,
      contact_method: contactMethod,
      stage: stageValue,
      notes: notes || null,
      next_follow_up_date: nextFollowUp || null,
    })
    .select("id")
    .single();

  if (actErr) {
    backToLog("error", `Could not log activity: ${actErr.message}`);
  }

  // 3. Advance stage + refresh contact details, but only on leads we own
  //    (RLS would reject updating someone else's lead).
  if (ownedByMe) {
    const patch: Record<string, unknown> = { stage: stageValue };
    if (contactName) patch.contact_name = contactName;
    if (contactEmail) patch.contact_email = contactEmail;
    if (contactPhone) patch.contact_phone = contactPhone;
    await supabase.from("slug_leads").update(patch).eq("id", leadId);
  }

  // 4. Maintain the follow-up queue for this rep on this lead.
  if (nextFollowUp) {
    await supabase
      .from("slug_follow_ups")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("lead_id", leadId)
      .eq("member_id", member.id)
      .eq("status", "pending");

    await supabase.from("slug_follow_ups").insert({
      lead_id: leadId,
      activity_id: activity?.id ?? null,
      member_id: member.id,
      due_date: nextFollowUp,
      status: "pending",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  revalidatePath("/pipeline");
  backToLog("success", `Logged activity for ${companyName}.`);
}

/** Marks a follow-up done. RLS ensures only the owning rep can. */
export async function completeFollowUp(formData: FormData) {
  const id = String(formData.get("follow_up_id") ?? "");
  if (!id) return;

  const supabase = createClient();
  await supabase
    .from("slug_follow_ups")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
}
