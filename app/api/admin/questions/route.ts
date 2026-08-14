import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function DELETE(req: Request) {
  const supabaseAuth = await createServerSupabaseClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const subtestId = searchParams.get('subtest_id');
  const questionId = searchParams.get('id');
  const deleteAll = searchParams.get('all') === 'true';

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    cookies: { get() { return ''; } }
  });

  try {
    if (deleteAll) {
      let query = supabase.from('questions').delete();
      if (subtestId) {
        query = query.eq('subtest_id', subtestId);
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }
      const { error: delErr } = await query;
      if (delErr) throw delErr;
      return NextResponse.json({ success: true });
    } else if (questionId) {
      const { error: delErr } = await supabase.from('questions').delete().eq('id', questionId);
      if (delErr) throw delErr;
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
