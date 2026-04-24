import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient } from "@/utils/supabase/serviceRole";

export async function middleware(request: NextRequest) {
  // Redirect legacy /planner route to root
  if (request.nextUrl.pathname === '/planner') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip Supabase auth refresh when env vars are missing or not yet configured
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseUrl.startsWith("http")
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Admin route guard — check auth + role before allowing access
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[admin-guard] No authenticated user — redirecting');
      return NextResponse.redirect(new URL('/', request.url));
    }
    console.log('[admin-guard] Authenticated user:', user.id);

    try {
      const serviceClient = createServiceRoleClient();
      const { data: userRole, error: roleError } = await serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      console.log('[admin-guard] Role query result:', { userRole, roleError: roleError?.message });

      if (!userRole || userRole.role !== 'admin') {
        console.log('[admin-guard] Not admin — redirecting');
        return NextResponse.redirect(new URL('/', request.url));
      }
      console.log('[admin-guard] Admin access granted');
    } catch (err) {
      console.log('[admin-guard] Caught error:', err);
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Refresh the auth session — result is intentionally unused.
  // This ensures session tokens stay fresh across navigations.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
