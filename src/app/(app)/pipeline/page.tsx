import { createClient } from "@/lib/supabase/server";
import { STATUSES, STATUS_LABELS, OPEN_STATUSES } from "@/lib/constants";
import { contactLabel, contactName, type ContactRef } from "@/lib/types";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  title: string | null;
  status: string;
  deal_value: number | null;
  assigned_to: string | null;
  updated_at: string;
  contacts: ContactRef;
};

function money(n: number | null) {
  if (n == null) return null;
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: { rep?: string };
}) {
  const supabase = createClient();
  const repFilter = searchParams.rep ?? "";

  // Distinct owners (free-text assigned_to) for the filter dropdown.
  const { data: owners } = await supabase
    .from("leads")
    .select("assigned_to")
    .not("assigned_to", "is", null);

  const reps = Array.from(
    new Set((owners ?? []).map((o) => o.assigned_to as string).filter(Boolean)),
  ).sort();

  let query = supabase
    .from("leads")
    .select(
      "id, title, status, deal_value, assigned_to, updated_at, contacts(company, first_name, last_name)",
    )
    .order("updated_at", { ascending: false });

  if (repFilter) query = query.eq("assigned_to", repFilter);

  const { data } = await query;
  const leads = (data ?? []) as unknown as LeadRow[];

  const byStatus: Record<string, LeadRow[]> = {};
  for (const s of STATUSES) byStatus[s] = [];
  for (const lead of leads) {
    (byStatus[lead.status] ??= []).push(lead);
  }

  const openLeads = leads.filter((l) => OPEN_STATUSES.includes(l.status));
  const openValue = openLeads.reduce((sum, l) => sum + (l.deal_value ?? 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Team pipeline</h1>
          <p>
            {repFilter
              ? `Showing ${repFilter}'s leads.`
              : "Showing the whole team's leads."}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <form method="get">
          <label htmlFor="rep" className="muted">
            View:
          </label>
          <select id="rep" name="rep" defaultValue={repFilter}>
            <option value="">Whole team</option>
            {reps.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="btn small" type="submit">
            Apply
          </button>
        </form>

        <span className="badge">
          {openLeads.length} open{openValue > 0 ? ` · ${money(openValue)}` : ""}
        </span>
      </div>

      {leads.length === 0 ? (
        <div className="card">
          <div className="empty">
            No leads in the pipeline yet. Logging an activity creates one.
          </div>
        </div>
      ) : (
        <div className="board">
          {STATUSES.map((status) => {
            const items = byStatus[status] ?? [];
            return (
              <div className="col" key={status}>
                <h3>
                  {STATUS_LABELS[status]}
                  <span className="count">{items.length}</span>
                </h3>
                {items.length === 0 ? (
                  <div className="empty" style={{ padding: 12, fontSize: 13 }}>
                    Empty
                  </div>
                ) : (
                  items.map((lead) => (
                    <div className="lead-card" key={lead.id}>
                      <div className="co">{contactLabel(lead.contacts)}</div>
                      <div className="meta">
                        {contactName(lead.contacts) !== contactLabel(lead.contacts)
                          ? contactName(lead.contacts) + " · "
                          : ""}
                        {lead.assigned_to ?? "Unassigned"}
                      </div>
                      {lead.deal_value != null && (
                        <div className="meta">{money(lead.deal_value)}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
