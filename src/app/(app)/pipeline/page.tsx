import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_LABELS, OPEN_STAGES, type Stage } from "@/lib/constants";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  stage: string;
  owner_id: string | null;
  estimated_value: number | null;
  updated_at: string;
  slug_team_members: { full_name: string } | null;
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

  const { data: members } = await supabase
    .from("slug_team_members")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  const repFilter = searchParams.rep ?? "";

  let query = supabase
    .from("slug_leads")
    .select(
      "id, company_name, contact_name, stage, owner_id, estimated_value, updated_at, slug_team_members(full_name)",
    )
    .order("updated_at", { ascending: false });

  if (repFilter) query = query.eq("owner_id", repFilter);

  const { data } = await query;
  const leads = (data ?? []) as unknown as LeadRow[];

  const byStage: Record<string, LeadRow[]> = {};
  for (const s of STAGES) byStage[s] = [];
  for (const lead of leads) {
    (byStage[lead.stage] ??= []).push(lead);
  }

  const openLeads = leads.filter((l) => OPEN_STAGES.includes(l.stage as Stage));
  const openValue = openLeads.reduce(
    (sum, l) => sum + (l.estimated_value ?? 0),
    0,
  );

  const selectedRep = members?.find((m) => m.id === repFilter)?.full_name;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Team pipeline</h1>
          <p>
            {repFilter
              ? `Showing ${selectedRep ?? "one rep"}'s leads.`
              : "Showing the whole team's leads."}
          </p>
        </div>
      </div>

      <div className="toolbar">
        {/* GET form keeps the filter in the URL (shareable / bookmarkable). */}
        <form method="get">
          <label htmlFor="rep" className="muted">
            View:
          </label>
          <select
            id="rep"
            name="rep"
            defaultValue={repFilter}
            // Native submit-on-change without client JS:
            // a plain submit button follows for no-JS fallback.
          >
            <option value="">Whole team</option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
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

      <div className="board">
        {STAGES.map((stage) => {
          const items = byStage[stage] ?? [];
          return (
            <div className="col" key={stage}>
              <h3>
                {STAGE_LABELS[stage]}
                <span className="count">{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <div className="empty" style={{ padding: 12, fontSize: 13 }}>
                  Empty
                </div>
              ) : (
                items.map((lead) => (
                  <div className="lead-card" key={lead.id}>
                    <div className="co">{lead.company_name}</div>
                    <div className="meta">
                      {lead.contact_name ? lead.contact_name + " · " : ""}
                      {lead.slug_team_members?.full_name ?? "Unassigned"}
                    </div>
                    {lead.estimated_value != null && (
                      <div className="meta">{money(lead.estimated_value)}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
