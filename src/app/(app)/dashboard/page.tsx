import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/member";
import { statusLabel, activityTypeLabel, OPEN_STATUSES } from "@/lib/constants";
import { contactLabel, type ContactRef } from "@/lib/types";

export const dynamic = "force-dynamic";

type ActivityRow = {
  id: string;
  type: string | null;
  summary: string | null;
  outcome: string | null;
  activity_date: string;
  logged_by: string | null;
  contacts: ContactRef;
};

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = createClient();
  const today = todayISO();

  const [
    { count: contactsCount },
    { data: dueLeads },
    { data: leadStatuses },
    { data: recent },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select("next_action_date, assigned_to")
      .not("next_action_date", "is", null)
      .not("status", "in", "(won,lost)"),
    supabase.from("leads").select("status"),
    supabase
      .from("activities")
      .select(
        "id, type, summary, outcome, activity_date, logged_by, contacts(company, first_name, last_name)",
      )
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const due = dueLeads ?? [];
  const overdue = due.filter((r) => (r.next_action_date as string) < today).length;
  const dueToday = due.filter((r) => (r.next_action_date as string) === today).length;
  const myDue = user
    ? due.filter(
        (r) =>
          r.assigned_to === user.email &&
          (r.next_action_date as string) <= today,
      ).length
    : 0;

  const openLeads = (leadStatuses ?? []).filter((l) =>
    OPEN_STATUSES.includes(l.status as string),
  ).length;

  const recentRows = (recent ?? []) as unknown as ActivityRow[];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back{user ? `, ${user.name}` : ""}.</p>
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
          <div className="n">{myDue}</div>
          <div className="l">My follow-ups</div>
        </Link>
        <Link href="/pipeline" className="card stat">
          <div className="n">{openLeads}</div>
          <div className="l">Open leads</div>
        </Link>
        <div className="card stat">
          <div className="n">{(contactsCount ?? 0).toLocaleString()}</div>
          <div className="l">Contacts</div>
        </div>
      </div>

      <div style={{ height: 22 }} />

      <div className="card">
        <h2>Recent activity</h2>
        {recentRows.length === 0 ? (
          <div className="empty">
            No activity logged yet. <Link href="/log">Log your first touch →</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Summary</th>
                  <th>Outcome</th>
                  <th>Logged by</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((a) => (
                  <tr key={a.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {a.activity_date}
                    </td>
                    <td style={{ fontWeight: 600 }}>{contactLabel(a.contacts)}</td>
                    <td>{activityTypeLabel(a.type)}</td>
                    <td className="muted">{a.summary ?? "—"}</td>
                    <td>{a.outcome ?? "—"}</td>
                    <td className="muted">{a.logged_by ?? "—"}</td>
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
