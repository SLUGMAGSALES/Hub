import { createClient } from "@/lib/supabase/server";
import { logActivity } from "../actions";
import {
  STAGES,
  STAGE_LABELS,
  CONTACT_METHODS,
  CONTACT_METHOD_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const supabase = createClient();

  // Suggest existing companies for fast, consistent entry (find-or-create).
  const { data: leads } = await supabase
    .from("slug_leads")
    .select("company_name")
    .order("company_name", { ascending: true })
    .limit(500);

  const companies = Array.from(
    new Set((leads ?? []).map((l) => l.company_name as string)),
  );

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
            <label htmlFor="company_name">Company *</label>
            <input
              id="company_name"
              name="company_name"
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
              New name creates a new lead you own. Existing name adds to that
              lead.
            </span>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="contact_name">Contact name</label>
              <input id="contact_name" name="contact_name" type="text" />
            </div>
            <div className="field">
              <label htmlFor="contact_method">How did you reach out? *</label>
              <select id="contact_method" name="contact_method" defaultValue="email" required>
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {CONTACT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="contact_email">Contact email</label>
              <input id="contact_email" name="contact_email" type="email" />
            </div>
            <div className="field">
              <label htmlFor="contact_phone">Contact phone</label>
              <input id="contact_phone" name="contact_phone" type="tel" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="stage">Stage</label>
            <select id="stage" name="stage" defaultValue="contacted">
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="notes">What happened?</label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Left a voicemail, sent the Q3 rate card, wants to talk after the CLC festival…"
            />
          </div>

          <div className="field">
            <label htmlFor="next_follow_up_date">Next follow-up date</label>
            <input
              id="next_follow_up_date"
              name="next_follow_up_date"
              type="date"
            />
            <span className="hint">
              Setting a date adds this lead to your follow-up list.
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
