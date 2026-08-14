import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Fixed API URL to prevent SSRF
    const apiUrl = 'https://pddikti.fastapicloud.dev';

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
