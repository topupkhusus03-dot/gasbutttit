import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabaseClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { nomor_peserta_utbk, user_id, skor = 1000 } = body;

    // Use service role if available, or fallback to authenticated client
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const adminSupabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      cookies: { get() { return ''; } }
    });

    // 1. Find profile
    let targetUserId = user_id;
    if (!targetUserId && nomor_peserta_utbk) {
      const { data: targetProf, error: profErr } = await supabaseAuth
        .from('profiles')
        .select('id, nama')
        .eq('nomor_peserta_utbk', nomor_peserta_utbk)
        .maybeSingle();

      if (profErr || !targetProf) {
        return NextResponse.json({ error: 'Peserta dengan nomor tersebut tidak ditemukan' }, { status: 404 });
      }
      targetUserId = targetProf.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'nomor_peserta_utbk atau user_id wajib diisi' }, { status: 400 });
    }

    // 2. Find or create exam session
    let sessionId: string | null = null;
    const { data: sessionData } = await adminSupabase
      .from('exam_sessions')
      .select('id')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionData) {
      sessionId = sessionData.id;
    } else {
      const { data: newSession, error: sessErr } = await adminSupabase
        .from('exam_sessions')
        .insert({
          user_id: targetUserId,
          status: 'completed',
          tanggal_tes: new Date().toISOString().split('T')[0]
        })
        .select('id')
        .single();

      if (sessErr || !newSession) {
        return NextResponse.json({ error: 'Gagal membuat sesi ujian' }, { status: 500 });
      }
      sessionId = newSession.id;
    }

    // 3. Upsert into exam_results
    const payload = {
      user_id: targetUserId,
      session_id: sessionId,
      skor_penalaran_umum: body.skor_penalaran_umum ?? skor,
      skor_ppu: body.skor_ppu ?? skor,
      skor_pbm: body.skor_pbm ?? skor,
      skor_pk: body.skor_pk ?? skor,
      skor_literasi_id: body.skor_literasi_id ?? skor,
      skor_literasi_id_saintek: body.skor_literasi_id_saintek ?? (skor * 0.52),
      skor_literasi_id_soshum: body.skor_literasi_id_soshum ?? (skor * 0.48),
      skor_literasi_en: body.skor_literasi_en ?? skor,
      skor_penalaran_matematika: body.skor_penalaran_matematika ?? skor,
      theta_penalaran_umum: 10,
      theta_ppu: 10,
      theta_pbm: 10,
      theta_pk: 10,
      theta_literasi_id: 10,
      theta_literasi_en: 10,
      theta_penalaran_matematika: 10,
      tanggal_selesai: new Date().toISOString()
    };

    const { error: resErr } = await adminSupabase
      .from('exam_results')
      .upsert(payload, { onConflict: 'session_id' });

    if (resErr) {
      console.error('Update exam_results error:', resErr);
      return NextResponse.json({ error: resErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengubah skor peserta menjadi ${skor}`,
      data: payload
    });
  } catch (error: any) {
    console.error('set-score error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
