import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const body = await req.json().catch(() => ({}));
    const apiUrl = body.apiUrl || 'https://pddikti.fastapicloud.dev';

    // Test API connectivity
    let pddiktiAvailable = false;
    try {
      const res = await fetch(`${apiUrl}/api/`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) pddiktiAvailable = true;
    } catch (err) {
      pddiktiAvailable = false;
    }

    return NextResponse.json({
      success: true,
      apiUrl,
      status: pddiktiAvailable ? 'ONLINE' : 'OFFLINE_FALLBACK',
      message: pddiktiAvailable
        ? 'Terhubung ke PDDikti API gateway.'
        : 'PDDikti API sedang limit/503. Menggunakan database master terverifikasi.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
