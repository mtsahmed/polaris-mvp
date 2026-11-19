import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

// "/" is the public landing page with the dark route map (public/how-it-works.html); the light
// copy is for signed-in pages only.
// Search files (robots, sitemap, manifest, share image) must be reachable signed out, or
// crawlers are sent to the sign-in page (docs/seo-plan.md).
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/auth",
  "/how-it-works.html",
  "/api/impact-report",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/opengraph-image",
  "/llms.txt",
  "/BingSiteAuth.xml", // Bing Webmaster Tools site verification (public/BingSiteAuth.xml)
  "/ccf5a106b3f9490fade1bab6bed13bc2.txt", // IndexNow key file (Bing, Yandex and others); the key is public by design
  "/.well-known",
  "/privacy",
  "/terms",
];

// Refreshes the Supabase session on every request and keeps signed-out users on public pages.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // getClaims verifies the JWT; do not trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(`${p}/`)));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (signedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/profiles";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
