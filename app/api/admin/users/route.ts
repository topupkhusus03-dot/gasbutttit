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
  const targetId = searchParams.get('id');
  const deleteAll = searchParams.get('all') === 'true';

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    cookies: { get() { return ''; } }
  });

  try {
    if (deleteAll) {
      // Get all non-admin user IDs
      const { data: users, error: fetchErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'user');

      if (fetchErr) throw fetchErr;

      const userIds = (users || []).map(u => u.id);

      if (userIds.length > 0) {
        // Delete profiles (cascades to exam_sessions, answers, results, violations, program_selections)
        const { error: delErr } = await supabase
          .from('profiles')
          .delete()
          .in('id', userIds);

        if (delErr) throw delErr;

        // If service key is available, delete from auth.users
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          for (const uid of userIds) {
            try {
              await supabase.auth.admin.deleteUser(uid);
            } catch (e) {
              console.warn('Failed to delete auth user:', uid, e);
            }
          }
        }
      }

      return NextResponse.json({ success: true, count: userIds.length });
    } else if (targetId) {
      // Check user is not admin
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', targetId)
        .single();

      if (targetProfile?.role === 'admin') {
        return NextResponse.json({ error: 'Tidak dapat menghapus akun admin.' }, { status: 400 });
      }

      const { error: delErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetId);

      if (delErr) throw delErr;

      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          await supabase.auth.admin.deleteUser(targetId);
        } catch (e) {
          console.warn('Failed to delete auth user:', targetId, e);
        }
      }

      return NextResponse.json({ success: true, deletedId: targetId });
    } else {
      return NextResponse.json({ error: 'Parameter id atau all diperlukan.' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
