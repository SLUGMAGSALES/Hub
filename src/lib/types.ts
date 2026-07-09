// Row shapes matching the assumed schema in supabase/migrations/0001_init.sql.
// If your live tables differ, update these types AND the queries that use them.

export type TeamMember = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type Lead = {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  stage: string;
  owner_id: string | null;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  lead_id: string;
  member_id: string | null;
  contact_method: string;
  stage: string | null;
  notes: string | null;
  next_follow_up_date: string | null;
  occurred_at: string;
  created_at: string;
};

export type FollowUp = {
  id: string;
  lead_id: string;
  activity_id: string | null;
  member_id: string | null;
  due_date: string;
  status: string;
  completed_at: string | null;
  created_at: string;
};
