import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/member";

// All routes in this group require an authenticated user.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already redirects unauthenticated users, but we re-check here so
  // no data route ever renders without a signed-in user.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          SLUG <span>Sales OS</span>
        </div>
        <Nav />
        <div className="sidebar-footer">
          <div style={{ fontWeight: 600, color: "var(--text)" }}>
            {user.name}
          </div>
          <div>{user.email}</div>
          <form action="/auth/signout" method="post" style={{ marginTop: 10 }}>
            <button className="btn secondary small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
