// Shared option lists for the real schema. leads.status defaults to 'new';
// activities.type and leads.assigned_to are free text today. These lists drive
// the form selects and the pipeline columns — extend them to match whatever
// values the team actually uses.

export const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

// Statuses still counted as an open deal (in the pipeline).
export const OPEN_STATUSES: string[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
];

// Activity "type" — how the rep touched the prospect.
export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "in_person",
  "social",
  "event",
  "text",
  "other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  in_person: "In person",
  social: "Social / DM",
  event: "Event",
  text: "Text",
  other: "Other",
};

export function statusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_LABELS[s] ?? s;
}

export function activityTypeLabel(t: string | null | undefined): string {
  if (!t) return "—";
  return ACTIVITY_TYPE_LABELS[t] ?? t;
}
