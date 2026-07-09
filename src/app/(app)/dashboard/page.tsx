import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateCurrentMember } from "@/lib/member";
import {
  STAGE_LABELS,
  CONTACT_METHOD_LABELS,
  OPEN_STAGES,
  type Stage,
  type ContactMethod,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type ActivityRow = {
  id: string;
  contact_method: string;
  stage: string | null;
  notes: string | null;
  occurred_at: string;
  slug_leads: { company_name: string } | null;
  slug_team_members: { full_name: string } | null;
};

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const member = await getOrCreateCurrentMember();
  const supabase = createClient();
  const today = todayISO();

  const [{ data: pending }, { data: leads }, { data: recent }] =
    await Promise.all([
      supabase
        .from("slug_follow_ups")
        .select("due_date, member_id")
        .eq("status", "pending"),
      supabase.from("slug_leads").select("stage"),
      supabase
        .from("slug_activities")
        .select(
          "id, contact_method, stage, notes, occurred_at, slug_leads(company_name), slug_team_members(full_name)",
        )
        .order("occurred_at", { ascending: false })
        .limit(12),
    ]);

  const pendingRows = pending ?? [];
  const overdue = pendingRows.filter((r) => (r.due_date as string) < today).length;
  const dueToday = pendingRows.filter((r) => (r.due_date as string) === today).length;
  const myOpen = member
    ? pendingRows.filter(
        (r) => r.member_id === member.id && (r.due_date as string) <= today,
      ).length
    : 0;

  const openLeads = (leads ?? []).filter((l) =>
    OPEN_STAGES.includes(l.stage as Stage),
  ).length;

  const recentRows = (recent ?? []) as unknown as ActivityRow[];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back{member ? `, ${member.full_name.split(" ")[0]}` : ""}.
          </p>
        </div>
        <Link href="/log" className="btn">
          Log activity
        </Link>
      </div>

      <div className="grid stat-grid">
        <Link href="/follow-ups" className="card stat">
          <div className="n" style={{ color: overdue ? "var(--red)" : undefined }}>
            {overdue}
          </div>
          <div className="l">Overdue</div>
        </Link>
        <Link href="/follow-ups" className="card stat">
          <div className="n" style={{ color: dueToday ? "var(--amber)" : undefined }}>
            {dueToday}
          </div>
          <div className="l">Due today</div>
        </Link>
        <Link href="/follow-ups?mine=1" className="card stat">
          <div className="n">{myOpen}</div>
          <div className="l">My follow-ups</div>
        </Link>
        <Link href="/pipeline" className="card stat">
          <div className="n">{openLeads}</div>
          <div className="l">Open leads</div>
        </Link>
      </div>

      <div style={{ height: 22 }} />

      <div className="card">
        <h2>Recent activity</h2>
        {recentRows.length === 0 ? (
          <div className="empty">
            No activity yet. <Link href="/log">Log your first touch →</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Company</th>
                  <th>Method</th>
                  <th>Stage</th>
                  <th>Rep</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((a) => (
                  <tr key={a.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {a.occurred_at.slice(0, 10)}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {a.slug_leads?.company_name ?? "—"}
                    </td>
                    <td>
                      {CONTACT_METHOD_LABELS[a.contact_method as ContactMethod] ??
                        a.contact_method}
                    </td>
                    <td>
                      {a.stage ? (
                        <span className={`badge ${a.stage}`}>
                          {STAGE_LABELS[a.stage as Stage] ?? a.stage}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{a.slug_team_members?.full_name ?? "—"}</td>
                    <td className="muted">{a.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
