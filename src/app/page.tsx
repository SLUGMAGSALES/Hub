import { redirect } from "next/navigation";

// The root simply forwards into the app. Middleware handles auth gating:
// unauthenticated users hitting /dashboard are redirected to /login.
export default function Home() {
  redirect("/dashboard");
}
