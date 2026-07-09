// Shared option lists. Kept in one place so the form selects, the pipeline
// columns, and validation all agree. These MUST match the values your team
// actually stores in slug_leads.stage / slug_activities.contact_method.

export const STAGES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

// Stages that still count as "in the pipeline" (open deals).
export const OPEN_STAGES: Stage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
];

export const CONTACT_METHODS = [
  "email",
  "phone",
  "in_person",
  "social",
  "event",
  "text",
  "other",
] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  email: "Email",
  phone: "Phone",
  in_person: "In person",
  social: "Social / DM",
  event: "Event",
  text: "Text",
  other: "Other",
};
