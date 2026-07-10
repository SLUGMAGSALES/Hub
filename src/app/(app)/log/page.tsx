import { createClient } from "@/lib/supabase/server";
import { logActivity } from "../actions";
import {
  STATUSES,
  STATUS_LABELS,
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const supabase = createClient();

  // Suggest recent companies for fast, consistent entry. Capped so the
  // datalist stays light even though contacts holds thousands of rows.
  const { data: contacts } = await supabase
    .from("contacts")
    .select("company")
    .not("company", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  const companies = Array.from(
    new Set((contacts ?? []).map((c) => c.company as string).filter(Boolean)),
  ).sort();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Log activity</h1>
          <p>Capture a lead touch in about 45 seconds.</p>
        </div>
      </div>

      {searchParams.error && (
        <div className="notice error">{searchParams.error}</div>
      )}
      {searchParams.success && (
        <div className="notice success">{searchParams.success}</div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <form action={logActivity}>
          <div className="field">
            <label htmlFor="company">Company *</label>
            <input
              id="company"
              name="company"
              list="company-list"
              placeholder="e.g. Publik Coffee"
              autoFocus
              required
            />
            <datalist id="company-list">
              {companies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <span className="hint">
              Existing company links to that contact; a new name creates a
              contact + lead you own.
            </span>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="contact_name">Contact name</label>
              <input id="contact_name" name="contact_name" type="text" />
            </div>
            <div className="field">
              <label htmlFor="type">How did you reach out? *</label>
              <select id="type" name="type" defaultValue="call" required>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTIVITY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="email">Contact email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div className="field">
              <label htmlFor="phone">Contact phone</label>
              <input id="phone" name="phone" type="tel" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="summary">What happened?</label>
            <textarea
              id="summary"
              name="summary"
              placeholder="Left a voicemail, sent the Q3 rate card, wants to talk after the CLC festival…"
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="outcome">Outcome</label>
              <input
                id="outcome"
                name="outcome"
                type="text"
                placeholder="e.g. Interested, No answer, Callback"
              />
            </div>
            <div className="field">
              <label htmlFor="status">Pipeline status</label>
              <select id="status" name="status" defaultValue="contacted">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="next_action">Next step</label>
              <input
                id="next_action"
                name="next_action"
                type="text"
                placeholder="e.g. Send proposal"
              />
            </div>
            <div className="field">
              <label htmlFor="deal_value">Deal value ($)</label>
              <input
                id="deal_value"
                name="deal_value"
                type="number"
                min="0"
                step="1"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="next_action_date">Next follow-up date</label>
            <input
              id="next_action_date"
              name="next_action_date"
              type="date"
            />
            <span className="hint">
              Setting a date adds this lead to the follow-up list.
            </span>
          </div>

          <button className="btn" type="submit">
            Log activity
          </button>
        </form>
      </div>
    </>
  );
}
