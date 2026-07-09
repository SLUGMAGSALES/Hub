import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateCurrentMember } from "@/lib/member";
import { completeFollowUp } from "../actions";
import { STAGE_LABELS, type Stage } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  due_date: string;
  status: string;
  member_id: string | null;
  slug_leads: {
    company_name: string;
    contact_name: string | null;
    stage: string;
  } | null;
  slug_team_members: { full_name: string } | null;
};

function todayISO() {
  // Server-local date as YYYY-MM-DD.
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage as Stage] ?? stage;
  return <span className={`badge ${stage}`}>{label}</span>;
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: { mine?: string };
}) {
  const member = await getOrCreateCurrentMember();
  const mineOnly = searchParams.mine === "1";
  const supabase = createClient();

  let query = supabase
    .from("slug_follow_ups")
    .select(
      "id, due_date, status, member_id, slug_leads(company_name, contact_name, stage), slug_team_members(full_name)",
    )
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  if (mineOnly && member) query = query.eq("member_id", member.id);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const today = todayISO();
  const overdue = rows.filter((r) => r.due_date < today);
  const dueToday = rows.filter((r) => r.due_date === today);
  const upcoming = rows.filter((r) => r.due_date > today);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Follow-ups</h1>
          <p>Built automatically from logged activity with a next follow-up date.</p>
        </div>
        <Link href="/log" className="btn small">
          Log activity
        </Link>
      </div>

      <div className="toolbar">
        <Link
          href="/follow-ups"
          className={"btn small " + (!mineOnly ? "" : "secondary")}
        >
          Whole team
        </Link>
        <Link
          href="/follow-ups?mine=1"
          className={"btn small " + (mineOnly ? "" : "secondary")}
        >
          Just mine
        </Link>
      </div>

      <Section
        title="Overdue"
        count={overdue.length}
        rows={overdue}
        badge="overdue"
        emptyText="Nothing overdue. Nice."
      />
      <div style={{ height: 18 }} />
      <Section
        title="Due today"
        count={dueToday.length}
        rows={dueToday}
        badge="today"
        emptyText="Nothing due today."
      />
      <div style={{ height: 18 }} />
      <Section
        title="Upcoming"
        count={upcoming.length}
        rows={upcoming}
        emptyText="No upcoming follow-ups scheduled."
      />
    </>
  );
}

function Section({
  title,
  count,
  rows,
  badge,
  emptyText,
}: {
  title: string;
  count: number;
  rows: Row[];
  badge?: "overdue" | "today";
  emptyText: string;
}) {
  return (
    <div className="card">
      <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {title} <span className="badge">{count}</span>
      </h2>
      {rows.length === 0 ? (
        <div className="empty">{emptyText}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Rep</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>
                    {r.slug_leads?.company_name ?? "—"}
                  </td>
                  <td>{r.slug_leads?.contact_name ?? "—"}</td>
                  <td>
                    {r.slug_leads?.stage ? (
                      <StageBadge stage={r.slug_leads.stage} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{r.slug_team_members?.full_name ?? "—"}</td>
                  <td>
                    {badge ? (
                      <span className={`badge ${badge}`}>{r.due_date}</span>
                    ) : (
                      r.due_date
                    )}
                  </td>
                  <td>
                    <form action={completeFollowUp}>
                      <input type="hidden" name="follow_up_id" value={r.id} />
                      <button className="btn secondary small" type="submit">
                        Mark done
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
