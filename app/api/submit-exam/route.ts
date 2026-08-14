import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateSubtestScore } from '@/lib/irt';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
    const { session_id, answers } = await request.json();

    if (!session_id || !answers) {
      return NextResponse.json({ error: 'Missing session_id or answers' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found or not owned by user' }, { status: 403 });
    }

    // Admin client to fetch full questions (with kunci_jawaban)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [subtestsRes, questionsRes] = await Promise.all([
      supabaseAdmin.from('subtests').select('*').order('urutan'),
      supabaseAdmin.from('questions').select('*')
    ]);

    const subtests = subtestsRes.data || [];
    const questions = questionsRes.data || [];

    const subtestScores: Record<string, { theta: number; score: number }> = {};

    for (const st of subtests) {
      const stQuestions = questions.filter(q => q.subtest_id === st.id);
      const responses = stQuestions.map(q => ({
        correct: answers[q.id] === q.kunci_jawaban,
        params: { a: Number(q.parameter_a), b: Number(q.parameter_b), c: Number(q.parameter_c) },
      }));
      subtestScores[st.kode] = calculateSubtestScore(responses);
    }

    const answersToInsert = questions.map(q => ({
      session_id: session_id,
      question_id: q.id,
      jawaban_user: answers[q.id] || null,
      benar: answers[q.id] ? answers[q.id] === q.kunci_jawaban : null,
    }));

    // Update answers (using admin client to bypass RLS and insert 'benar')
    await supabaseAdmin.from('answers').upsert(answersToInsert, { onConflict: 'session_id,question_id' });

    const lbiScore = subtestScores['LBI']?.score ?? 0;
    const lbeScore = subtestScores['LBE']?.score ?? 0;
    const lbeTheta = subtestScores['LBE']?.theta ?? 0;

    await supabaseAdmin.from('exam_results').insert({
      user_id: user.id,
      session_id: session_id,
      skor_penalaran_umum: subtestScores['PU']?.score ?? 0,
      skor_ppu: subtestScores['PPU']?.score ?? 0,
      skor_pbm: subtestScores['PBM']?.score ?? 0,
      skor_pk: subtestScores['PK']?.score ?? 0,
      skor_literasi_id: lbiScore,
      skor_literasi_id_saintek: lbiScore * 0.52,
      skor_literasi_id_soshum: lbiScore * 0.48,
      skor_literasi_en: lbeScore,
      skor_penalaran_matematika: subtestScores['PM']?.score ?? 0,
      theta_penalaran_umum: subtestScores['PU']?.theta ?? 0,
      theta_ppu: subtestScores['PPU']?.theta ?? 0,
      theta_pbm: subtestScores['PBM']?.theta ?? 0,
      theta_pk: subtestScores['PK']?.theta ?? 0,
      theta_literasi_id: subtestScores['LBI']?.theta ?? 0,
      theta_literasi_en: lbeTheta,
      theta_penalaran_matematika: subtestScores['PM']?.theta ?? 0,
      tanggal_selesai: new Date().toISOString(),
    });

    await supabaseAdmin.from('exam_sessions').update({
      status: 'completed',
      waktu_selesai: new Date().toISOString(),
    }).eq('id', session_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error submitting exam:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
