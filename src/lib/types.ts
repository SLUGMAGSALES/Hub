// Row shapes for the REAL Supabase schema (project tlblflodoteuvdhorfaw).
// These map to existing tables — the app does NOT create or own them.

export type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  instagram: string | null;
  source: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pipeline_id: string | null;
  assigned_to: string | null;
};

export type Lead = {
  id: string;
  contact_id: string | null;
  title: string | null;
  status: string;
  deal_value: number | null;
  ad_type: string | null;
  issue_target: string | null;
  assigned_to: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contacted: string | null;
  probability: number | null;
  lost_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  contact_id: string | null;
  lead_id: string | null;
  type: string | null;
  summary: string | null;
  outcome: string | null;
  logged_by: string | null;
  activity_date: string;
  created_at: string;
};

export type Deal = {
  id: string;
  contact_id: string | null;
  lead_id: string | null;
  title: string | null;
  value: number | null;
  ad_type: string | null;
  issue: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  invoice_sent: boolean;
  payment_received: boolean;
  notes: string | null;
  created_at: string;
};

export type DailyLog = {
  id: string;
  logged_by: string | null;
  log_date: string;
  raw_text: string | null;
  calls_made: number | null;
  emails_sent: number | null;
  meetings: number | null;
  new_leads: number | null;
  follow_ups: number | null;
  notes: string | null;
  slack_ts: string | null;
  created_at: string;
};

// Shape returned when a lead/activity is embedded with its contact.
export type ContactRef = {
  company: string | null;
  first_name: string | null;
  last_name: string | null;
} | null;

export function contactName(c: ContactRef): string {
  if (!c) return "—";
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.company || "—";
}

export function contactLabel(c: ContactRef): string {
  if (!c) return "—";
  return c.company || contactName(c);
}
