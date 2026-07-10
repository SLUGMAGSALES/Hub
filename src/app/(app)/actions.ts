"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/member";
import { STATUSES, ACTIVITY_TYPES } from "@/lib/constants";

function backToLog(kind: "error" | "success", message: string) {
  redirect(`/log?${kind}=${encodeURIComponent(message)}`);
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Logs a lead touch against the REAL schema:
 *   1. resolve the contact (by hidden id, else by company name, else create it)
 *   2. ensure an open lead exists for that contact (create if none)
 *   3. update the lead's status / next action / value / last_contacted
 *   4. insert the activity, linked to both contact and lead
 * `logged_by` / `assigned_to` are the signed-in user's email for now.
 */
export async function logActivity(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const contactIdInput = String(formData.get("contact_id") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "").trim();
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const nextActionDate = String(formData.get("next_action_date") ?? "").trim();
  const dealValueRaw = String(formData.get("deal_value") ?? "").trim();

  if (!contactIdInput && !company) {
    backToLog("error", "Pick a contact or enter a company.");
  }
  if (!ACTIVITY_TYPES.includes(type as never)) {
    backToLog("error", "Pick a valid activity type.");
  }
  const statusValue = STATUSES.includes(status as never) ? status : "new";
  const dealValue =
    dealValueRaw && !Number.isNaN(Number(dealValueRaw))
      ? Number(dealValueRaw)
      : null;

  const supabase = createClient();
  const today = todayISO();

  // 1. Resolve the contact.
  let contactId = contactIdInput;
  if (!contactId) {
    const { data: found } = await supabase
      .from("contacts")
      .select("id")
      .ilike("company", company)
      .limit(1)
      .maybeSingle();

    if (found) {
      contactId = found.id as string;
    } else {
      const { first, last } = splitName(contactName);
      const { data: createdContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          company: company || null,
          first_name: first,
          last_name: last,
          email: email || null,
          phone: phone || null,
          assigned_to: user.email,
          source: "Sales OS",
        })
        .select("id")
        .single();

      if (contactErr || !createdContact) {
        backToLog(
          "error",
          `Could not create contact: ${contactErr?.message ?? "unknown"}`,
        );
      }
      contactId = createdContact!.id as string;
    }
  }

  // 2. Ensure an open lead for this contact.
  const { data: openLead } = await supabase
    .from("leads")
    .select("id")
    .eq("contact_id", contactId)
    .not("status", "in", "(won,lost)")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let leadId: string;
  if (openLead) {
    leadId = openLead.id as string;
  } else {
    const { data: createdLead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        contact_id: contactId,
        title: company || contactName || "New lead",
        status: statusValue,
        assigned_to: user.email,
      })
      .select("id")
      .single();

    if (leadErr || !createdLead) {
      backToLog("error", `Could not create lead: ${leadErr?.message ?? "unknown"}`);
    }
    leadId = createdLead!.id as string;
  }

  // 3. Update the lead with the latest status / next action / value.
  const leadPatch: Record<string, unknown> = {
    status: statusValue,
    last_contacted: today,
  };
  if (nextAction) leadPatch.next_action = nextAction;
  if (nextActionDate) leadPatch.next_action_date = nextActionDate;
  if (dealValue !== null) leadPatch.deal_value = dealValue;
  await supabase.from("leads").update(leadPatch).eq("id", leadId);

  // 4. Insert the activity, linked to both contact and lead.
  const { error: actErr } = await supabase.from("activities").insert({
    contact_id: contactId,
    lead_id: leadId,
    type,
    summary: summary || null,
    outcome: outcome || null,
    logged_by: user.email,
    activity_date: today,
  });

  if (actErr) {
    backToLog("error", `Could not log activity: ${actErr.message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  revalidatePath("/pipeline");
  backToLog("success", `Logged ${type} for ${company || contactName || "contact"}.`);
}

/**
 * Clears a lead's follow-up (its next_action_date) so it drops off the due
 * list, and stamps last_contacted. This is the "Mark done" action.
 */
export async function completeFollowUp(formData: FormData) {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return;

  const supabase = createClient();
  await supabase
    .from("leads")
    .update({ next_action_date: null, last_contacted: todayISO() })
    .eq("id", leadId);

  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
}
