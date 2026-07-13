import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateContact, startLead } from "../../actions";
import { statusLabel, activityTypeLabel } from "@/lib/constants";
import type { Contact, Lead, Activity, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

function money(n: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; success?: string };
}) {
  const supabase = createClient();
  const id = params.id;

  const { data: contactData, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="notice error">Could not load contact: {error.message}</div>
    );
  }
  if (!contactData) notFound();
  const contact = contactData as Contact;

  const [{ data: leadsData }, { data: activitiesData }, { data: dealsData }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, title, status, deal_value, next_action, next_action_date, assigned_to, updated_at")
        .eq("contact_id", id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("activities")
        .select("id, type, summary, outcome, activity_date, logged_by, created_at")
        .eq("contact_id", id)
        .order("activity_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("deals")
        .select("id, title, value, status, ad_type, issue, invoice_sent, payment_received")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const leads = (leadsData ?? []) as unknown as Lead[];
  const activities = (activitiesData ?? []) as unknown as Activity[];
  const deals = (dealsData ?? []) as unknown as Deal[];

  const displayName =
    contact.company ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    "Contact";
  const logHref = `/log?contact=${contact.id}&company=${encodeURIComponent(
    contact.company ?? "",
  )}`;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="crumb">
            <Link href="/contacts" className="muted">
              ← Contacts
            </Link>
          </div>
          <h1>{displayName}</h1>
          <p>
            {[contact.title, contact.city, contact.state]
              .filter(Boolean)
              .join(" · ") || "No title / location on file"}
          </p>
        </div>
        <div className="header-actions">
          <form action={startLead}>
            <input type="hidden" name="contact_id" value={contact.id} />
            <button className="btn secondary" type="submit">
              Start a lead
            </button>
          </form>
          <Link href={logHref} className="btn">
            Log a touch
          </Link>
        </div>
      </div>

      {searchParams.error && <div className="notice error">{searchParams.error}</div>}
      {searchParams.success && (
        <div className="notice success">{searchParams.success}</div>
      )}

      <div className="detail-grid">
        {/* Editable contact info */}
        <div className="card">
          <h2>Contact info</h2>
          <form action={updateContact}>
            <input type="hidden" name="id" value={contact.id} />
            <div className="row">
              <Field name="first_name" label="First name" value={contact.first_name} />
              <Field name="last_name" label="Last name" value={contact.last_name} />
            </div>
            <div className="row">
              <Field name="company" label="Company" value={contact.company} />
              <Field name="title" label="Title" value={contact.title} />
            </div>
            <div className="row">
              <Field name="email" label="Email" value={contact.email} type="email" />
              <Field name="phone" label="Phone" value={contact.phone} type="tel" />
            </div>
            <Field name="address" label="Address" value={contact.address} />
            <div className="row">
              <Field name="city" label="City" value={contact.city} />
              <Field name="state" label="State" value={contact.state} />
            </div>
            <div className="row">
              <Field name="website" label="Website" value={contact.website} />
              <Field name="instagram" label="Instagram" value={contact.instagram} />
            </div>
            <div className="row">
              <Field name="source" label="Source" value={contact.source} />
              <Field name="assigned_to" label="Assigned to" value={contact.assigned_to} />
            </div>
            <Field
              name="tags"
              label="Tags"
              value={contact.tags?.join(", ") ?? ""}
              hint="Comma-separated"
            />
            <div className="field">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" defaultValue={contact.notes ?? ""} />
            </div>
            <button className="btn" type="submit">
              Save changes
            </button>
          </form>
        </div>

        {/* Related data sidebar */}
        <div className="stack">
          <div className="card">
            <h2>
              Leads <span className="badge">{leads.length}</span>
            </h2>
            {leads.length === 0 ? (
              <div className="empty" style={{ padding: 12 }}>
                No leads yet.
              </div>
            ) : (
              <ul className="related">
                {leads.map((l) => (
                  <li key={l.id}>
                    <div className="related-main">
                      <span className={`badge ${l.status}`}>
                        {statusLabel(l.status)}
                      </span>
                      <span>{l.title || "Untitled lead"}</span>
                    </div>
                    <div className="related-meta">
                      {money(l.deal_value)}
                      {l.next_action_date ? ` · next ${l.next_action_date}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2>
              Deals <span className="badge">{deals.length}</span>
            </h2>
            {deals.length === 0 ? (
              <div className="empty" style={{ padding: 12 }}>
                No deals yet.
              </div>
            ) : (
              <ul className="related">
                {deals.map((d) => (
                  <li key={d.id}>
                    <div className="related-main">
                      <span className="badge">{d.status}</span>
                      <span>{d.title || d.ad_type || "Deal"}</span>
                    </div>
                    <div className="related-meta">
                      {money(d.value)}
                      {d.invoice_sent ? " · invoiced" : ""}
                      {d.payment_received ? " · paid" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Activity timeline */}
      <div style={{ height: 18 }} />
      <div className="card">
        <h2>
          Activity timeline <span className="badge">{activities.length}</span>
        </h2>
        {activities.length === 0 ? (
          <div className="empty">
            No activity logged for this contact yet.{" "}
            <Link href={logHref}>Log the first touch →</Link>
          </div>
        ) : (
          <ul className="timeline">
            {activities.map((a) => (
              <li key={a.id}>
                <div className="tl-dot" />
                <div className="tl-body">
                  <div className="tl-head">
                    <span className="badge">{activityTypeLabel(a.type)}</span>
                    <span className="muted">{a.activity_date}</span>
                    {a.outcome && <span className="tl-outcome">{a.outcome}</span>}
                  </div>
                  {a.summary && <div className="tl-summary">{a.summary}</div>}
                  {a.logged_by && (
                    <div className="muted tl-by">— {a.logged_by}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  hint,
}: {
  name: string;
  label: string;
  value: string | null;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value ?? ""} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
