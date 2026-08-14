import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function DELETE(req: Request) {
  let adminUserId: string | null = null;

  // 1. Try auth via Server SSR cookies
  try {
    const supabaseAuth = await createServerSupabaseClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) adminUserId = user.id;
  } catch (e) {}

  // 2. Try auth via Bearer Token header
  const authHeader = req.headers.get('Authorization');
  if (!adminUserId && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const supabaseJwt = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await supabaseJwt.auth.getUser(token);
    if (user) adminUserId = user.id;
  }

  if (!adminUserId) {
    return NextResponse.json({ error: 'Unauthorized: Sesi tidak ditemukan atau kedaluwarsa.' }, { status: 401 });
  }

  // Use service role key if available, else anon key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false }
  });

  // Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', adminUserId)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Hanya admin yang dapat menghapus user.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get('id');
  const deleteAll = searchParams.get('all') === 'true';

  try {
    let targetUserIds: string[] = [];

    if (deleteAll) {
      const { data: users, error: fetchErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'user');

      if (fetchErr) throw fetchErr;
      targetUserIds = (users || []).map(u => u.id);
    } else if (targetId) {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', targetId)
        .single();

      if (targetProfile?.role === 'admin') {
        return NextResponse.json({ error: 'Tidak dapat menghapus akun admin.' }, { status: 400 });
      }
      targetUserIds = [targetId];
    } else {
      return NextResponse.json({ error: 'Parameter id atau all diperlukan.' }, { status: 400 });
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Step-by-step cascading delete to avoid foreign key errors
    // 1. Get all session IDs for these users
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('id')
      .in('user_id', targetUserIds);

    const sessionIds = (sessions || []).map(s => s.id);

    if (sessionIds.length > 0) {
      await supabase.from('answers').delete().in('session_id', sessionIds);
      await supabase.from('exam_violations').delete().in('session_id', sessionIds);
    }

    await supabase.from('exam_results').delete().in('user_id', targetUserIds);
    await supabase.from('exam_sessions').delete().in('user_id', targetUserIds);
    await supabase.from('program_selections').delete().in('user_id', targetUserIds);
    
    // Delete from public.profiles
    const { error: delProfileErr } = await supabase
      .from('profiles')
      .delete()
      .in('id', targetUserIds);

    if (delProfileErr) {
      // If RLS blocked, try calling SQL RPC delete_user_by_admin / delete_all_users_by_admin
      if (deleteAll) {
        await supabase.rpc('delete_all_users_by_admin');
      } else if (targetId) {
        await supabase.rpc('delete_user_by_admin', { target_user_id: targetId });
      }
    }

    // Also remove from auth.users if service role key is active
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      for (const uid of targetUserIds) {
        try {
          await supabase.auth.admin.deleteUser(uid);
        } catch (e) {
          console.warn('Could not delete auth user:', uid, e);
        }
      }
    }

    return NextResponse.json({ success: true, count: targetUserIds.length });
  } catch (err: any) {
    console.error('Error deleting users:', err);
    return NextResponse.json({ error: err.message || 'Gagal menghapus data user.' }, { status: 500 });
  }
}
