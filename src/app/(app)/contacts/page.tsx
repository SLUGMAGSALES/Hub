import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
// Cap for the "engaged" id sets used by the relationship segments. These sets
// (contacts that have a lead / an activity) stay small relative to the 9.6k
// contacts, so an in / not.in list is efficient and URL-safe. If a set ever
// hits this cap the segment becomes approximate — see note rendered below.
const ENGAGED_CAP = 1000;

type SearchParams = {
  q?: string;
  assigned?: string;
  city?: string;
  state?: string;
  source?: string;
  tag?: string;
  segment?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const SORT_COLUMNS: Record<string, string> = {
  company: "company",
  created_at: "created_at",
  updated_at: "updated_at",
};

const SEGMENTS = [
  { key: "", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "never_contacted", label: "Never contacted" },
  { key: "has_open_lead", label: "Has open lead" },
  { key: "no_lead", label: "No lead yet" },
];

function sanitize(term: string) {
  // Strip characters that would break a PostgREST or() expression.
  return term.replace(/[,()%*\\]/g, " ").trim();
}

function buildQS(sp: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...sp, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function engagedContactIds(
  supabase: SupabaseClient,
  table: "leads" | "activities",
  openLeadsOnly: boolean,
): Promise<{ ids: string[]; capped: boolean }> {
  const base = supabase
    .from(table)
    .select("contact_id")
    .not("contact_id", "is", null);
  const query =
    table === "leads" && openLeadsOnly
      ? base.not("status", "in", "(won,lost)")
      : base;
  const { data } = await query.limit(ENGAGED_CAP);
  const rows = (data ?? []) as { contact_id: string | null }[];
  const ids = Array.from(
    new Set(rows.map((r) => r.contact_id).filter(Boolean)),
  ) as string[];
  return { ids, capped: rows.length >= ENGAGED_CAP };
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();

  const q = (searchParams.q ?? "").trim();
  const assigned = (searchParams.assigned ?? "").trim();
  const city = (searchParams.city ?? "").trim();
  const state = (searchParams.state ?? "").trim();
  const source = (searchParams.source ?? "").trim();
  const tag = (searchParams.tag ?? "").trim();
  const segment = (searchParams.segment ?? "").trim();
  const sort = SORT_COLUMNS[searchParams.sort ?? ""] ?? "company";
  const dir = searchParams.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, company, title, email, phone, city, state, source, tags, assigned_to",
      { count: "exact" },
    );

  // Full-text-ish search across the requested columns.
  if (q) {
    const p = `%${sanitize(q)}%`;
    query = query.or(
      [
        `first_name.ilike.${p}`,
        `last_name.ilike.${p}`,
        `company.ilike.${p}`,
        `email.ilike.${p}`,
        `phone.ilike.${p}`,
        `city.ilike.${p}`,
      ].join(","),
    );
  }

  // Column filters.
  if (assigned) {
    if (assigned === "unassigned") query = query.is("assigned_to", null);
    else query = query.eq("assigned_to", assigned);
  }
  if (city) query = query.ilike("city", city);
  if (state) query = query.ilike("state", state);
  if (source) query = query.ilike("source", source);
  if (tag) query = query.contains("tags", [tag]);

  // Smart segments (relationship-based).
  let segmentNote: string | null = null;
  if (segment === "unassigned") {
    query = query.is("assigned_to", null);
  } else if (segment === "never_contacted") {
    const { ids, capped } = await engagedContactIds(supabase, "activities", false);
    if (ids.length) query = query.not("id", "in", `(${ids.join(",")})`);
    if (capped) segmentNote = "Approximate: many contacts have activity.";
  } else if (segment === "has_open_lead") {
    const { ids } = await engagedContactIds(supabase, "leads", true);
    if (ids.length) query = query.in("id", ids);
    else query = query.eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (segment === "no_lead") {
    const { ids, capped } = await engagedContactIds(supabase, "leads", false);
    if (ids.length) query = query.not("id", "in", `(${ids.join(",")})`);
    if (capped) segmentNote = "Approximate: many contacts have leads.";
  }

  const { data, count, error } = await query
    .order(sort, { ascending: dir === "asc", nullsFirst: false })
    .range(from, to);
  const contacts = (data ?? []) as unknown as Contact[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(from + PAGE_SIZE, total);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Contacts</h1>
          <p>{total.toLocaleString()} contacts in the directory.</p>
        </div>
        <Link href="/log" className="btn small">
          Log activity
        </Link>
      </div>

      {/* Sticky search + filter bar */}
      <div className="filterbar">
        <form method="get" className="filter-form">
          {/* Preserve segment/sort across a filter submit */}
          {segment && <input type="hidden" name="segment" value={segment} />}
          <input type="hidden" name="sort" value={searchParams.sort ?? "company"} />
          <input type="hidden" name="dir" value={dir} />
          <input
            className="search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, company, email, phone, city…"
          />
          <input type="text" name="assigned" defaultValue={assigned} placeholder="Assigned to" />
          <input type="text" name="city" defaultValue={city} placeholder="City" />
          <input type="text" name="state" defaultValue={state} placeholder="State" />
          <input type="text" name="source" defaultValue={source} placeholder="Source" />
          <input type="text" name="tag" defaultValue={tag} placeholder="Tag" />
          <button className="btn small" type="submit">
            Apply
          </button>
          <Link href="/contacts" className="btn secondary small">
            Reset
          </Link>
        </form>

        <div className="segments">
          {SEGMENTS.map((s) => (
            <Link
              key={s.key || "all"}
              href={buildQS(searchParams, { segment: s.key, page: "1" })}
              className={"seg " + (segment === s.key ? "active" : "")}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {segmentNote && <div className="notice">{segmentNote}</div>}
      {error && (
        <div className="notice error">Could not load contacts: {error.message}</div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {contacts.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>
            {q || assigned || city || state || source || tag || segment
              ? "No contacts match these filters."
              : "No contacts found."}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTh label="Company" col="company" sp={searchParams} sort={sort} dir={dir} />
                  <th>Name</th>
                  <th>City</th>
                  <th>Tags</th>
                  <th>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const name = [c.first_name, c.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/contacts/${c.id}`} className="rowlink">
                          {c.company || name || "—"}
                        </Link>
                      </td>
                      <td>{name || "—"}</td>
                      <td className="muted">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td>
                        {c.tags && c.tags.length ? (
                          <span className="chips">
                            {c.tags.slice(0, 3).map((t) => (
                              <span className="chip" key={t}>
                                {t}
                              </span>
                            ))}
                            {c.tags.length > 3 && (
                              <span className="chip more">+{c.tags.length - 3}</span>
                            )}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="muted">
                        {c.assigned_to || (
                          <span className="badge">unassigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span className="muted">
          {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of{" "}
          {total.toLocaleString()}
        </span>
        <div className="pager">
          {page > 1 ? (
            <Link className="btn secondary small" href={buildQS(searchParams, { page: String(page - 1) })}>
              ← Prev
            </Link>
          ) : (
            <span className="btn secondary small" aria-disabled>
              ← Prev
            </span>
          )}
          <span className="muted">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link className="btn secondary small" href={buildQS(searchParams, { page: String(page + 1) })}>
              Next →
            </Link>
          ) : (
            <span className="btn secondary small" aria-disabled>
              Next →
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function SortableTh({
  label,
  col,
  sp,
  sort,
  dir,
}: {
  label: string;
  col: string;
  sp: SearchParams;
  sort: string;
  dir: string;
}) {
  const active = sort === col;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th>
      <Link href={buildQS(sp, { sort: col, dir: nextDir, page: "1" })} className="th-sort">
        {label}
        {arrow}
      </Link>
    </th>
  );
}
