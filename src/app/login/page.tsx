import { signIn, signUp } from "./actions";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string };
}) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          SLUG <span>Sales OS</span>
        </div>
        <p className="auth-sub">Sign in to view the team pipeline.</p>

        {searchParams.error && (
          <div className="notice error">{searchParams.error}</div>
        )}
        {searchParams.notice && (
          <div className="notice success">{searchParams.notice}</div>
        )}

        <form>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn" style={{ width: "100%" }} formAction={signIn}>
            Sign in
          </button>

          <details className="mt">
            <summary className="muted" style={{ cursor: "pointer" }}>
              First time here? Create an account
            </summary>
            <div className="mt">
              <div className="field">
                <label htmlFor="full_name">Full name</label>
                <input id="full_name" name="full_name" type="text" />
              </div>
              <button
                className="btn secondary"
                style={{ width: "100%" }}
                formAction={signUp}
              >
                Create account
              </button>
              <p className="hint mt">
                Accounts are usually created by an admin in Supabase. Sign-up may
                require email confirmation depending on project settings.
              </p>
            </div>
          </details>
        </form>
      </div>
    </div>
  );
}
