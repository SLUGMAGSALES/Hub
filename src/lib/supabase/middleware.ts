import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Shape of the array @supabase/ssr passes to `setAll`. Annotated explicitly so
// the build stays green under strict mode's `noImplicitAny`.
type CookieToSet = { name: string; value: string; options?: CookieOptions };

function isPublicPath(path: string) {
  return (
    path === "/login" ||
    path.startsWith("/auth") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico"
  );
}

function redirectToLogin(request: NextRequest, from?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (from) url.searchParams.set("redirectedFrom", from);
  return NextResponse.redirect(url);
}

/**
 * Refreshes the Supabase session on every request and gates protected routes.
 *
 * This runs in the Edge runtime for every matched path, so it must NEVER throw:
 * an uncaught error here surfaces as a site-wide MIDDLEWARE_INVOCATION_FAILED
 * 500. Two guards keep it safe:
 *   1. If Supabase env vars are missing, we can't verify a session at all, so
 *      we treat every request as unauthenticated — public paths pass through,
 *      everything else redirects to /login (which renders without Supabase).
 *   2. Any unexpected failure during session refresh (network, Supabase down)
 *      is caught and degraded the same way, never 500ing the whole site.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = isPublicPath(path);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard 1: no credentials configured -> fail safe instead of crashing.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase env vars missing in middleware: set NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY. Skipping session refresh.",
    );
    return isPublic
      ? NextResponse.next({ request })
      : redirectToLogin(request);
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // IMPORTANT: do not run code between createServerClient and getUser().
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublic) {
      return redirectToLogin(request, path);
    }

    // Already signed in and hitting the login page? Send them to the dashboard.
    if (user && path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    // Guard 2: session refresh blew up unexpectedly. Don't expose protected
    // data and don't 500 — degrade to the same safe behavior as "no session".
    console.error("Middleware session refresh failed:", error);
    return isPublic ? supabaseResponse : redirectToLogin(request, path);
  }
}
