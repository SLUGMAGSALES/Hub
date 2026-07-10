import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/member";
import { completeFollowUp } from "../actions";
import { statusLabel } from "@/lib/constants";
import { contactLabel, contactName, type ContactRef } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  status: string;
  next_action: string | null;
  next_action_date: string;
  assigned_to: string | null;
  contacts: ContactRef;
};

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: { mine?: string };
}) {
  const user = await getCurrentUser();
  const mineOnly = searchParams.mine === "1";
  const supabase = createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, status, next_action, next_action_date, assigned_to, contacts(company, first_name, last_name)",
    )
    .not("next_action_date", "is", null)
    .not("status", "in", "(won,lost)")
    .order("next_action_date", { ascending: true });

  if (mineOnly && user) query = query.eq("assigned_to", user.email);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const today = todayISO();
  const overdue = rows.filter((r) => r.next_action_date < today);
  const dueToday = rows.filter((r) => r.next_action_date === today);
  const upcoming = rows.filter((r) => r.next_action_date > today);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Follow-ups</h1>
          <p>Leads with a next follow-up date — overdue and due today first.</p>
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

      <Section title="Overdue" rows={overdue} badge="overdue" emptyText="Nothing overdue. Nice." />
      <div style={{ height: 18 }} />
      <Section title="Due today" rows={dueToday} badge="today" emptyText="Nothing due today." />
      <div style={{ height: 18 }} />
      <Section title="Upcoming" rows={upcoming} emptyText="No upcoming follow-ups scheduled." />
    </>
  );
}

function Section({
  title,
  rows,
  badge,
  emptyText,
}: {
  title: string;
  rows: Row[];
  badge?: "overdue" | "today";
  emptyText: string;
}) {
  return (
    <div className="card">
      <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {title} <span className="badge">{rows.length}</span>
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
                <th>Next step</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{contactLabel(r.contacts)}</td>
                  <td>{contactName(r.contacts)}</td>
                  <td>{r.next_action ?? "—"}</td>
                  <td>
                    <span className={`badge ${r.status}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="muted">{r.assigned_to ?? "—"}</td>
                  <td>
                    {badge ? (
                      <span className={`badge ${badge}`}>{r.next_action_date}</span>
                    ) : (
                      r.next_action_date
                    )}
                  </td>
                  <td>
                    <form action={completeFollowUp}>
                      <input type="hidden" name="lead_id" value={r.id} />
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
