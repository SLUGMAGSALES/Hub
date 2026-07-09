import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getOrCreateCurrentMember } from "@/lib/member";

// All routes in this group require an authenticated, provisioned rep.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already redirects unauthenticated users, but we re-check here so
  // no data route ever renders without a signed-in, provisioned member.
  const member = await getOrCreateCurrentMember();
  if (!member) {
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
            {member.full_name}
          </div>
          <div>{member.email}</div>
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
