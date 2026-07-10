import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { calculateSubtestScore } from '@/lib/irt';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const supabaseAuth = await createServerSupabaseClient();

  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create a service role client to bypass RLS for updates, or fallback to anon if not provided (though RLS might block)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    cookies: { get() { return ''; } } // no cookies needed for service role
  });

  try {
    // 1. Get all completed sessions
    const { data: sessions, error: sessionsErr } = await supabaseAuth
      .from('exam_sessions')
      .select('id, user_id')
      .eq('status', 'completed');
    if (sessionsErr) throw sessionsErr;
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: true, updatedQuestions: 0, updatedResults: 0 });
    }

    const sessionIds = sessions.map(s => s.id);

    // 2. Get all answers for completed sessions
    let allAnswers: any[] = [];
    const chunkSize = 100;
    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);
      const { data: answersChunk, error: answersErr } = await supabaseAuth
        .from('answers')
        .select('session_id, question_id, benar')
        .in('session_id', chunk);
      if (answersErr) throw answersErr;
      if (answersChunk) allAnswers = allAnswers.concat(answersChunk);
    }

    // 3. Calculate P-values and update question parameter_b
    const qStats = new Map();
    for (const a of allAnswers) {
      if (!qStats.has(a.question_id)) {
        qStats.set(a.question_id, { total: 0, correct: 0 });
      }
      const stat = qStats.get(a.question_id);
      stat.total++;
      if (a.benar === true) stat.correct++;
    }

    let updatedQuestionsCount = 0;
    for (const [qId, stat] of qStats.entries()) {
      if (stat.total > 0) {
        let p = stat.correct / stat.total;
        p = Math.max(0.01, Math.min(0.99, p));
        let b = -Math.log(p / (1 - p));
        
        // Use service role if available for updates
        const { error: updErr } = await supabase
          .from('questions')
          .update({ parameter_b: b })
          .eq('id', qId);
        // Silently ignore RLS error on question update if admin policy is missing
        if (!updErr) updatedQuestionsCount++;
      }
    }

    // 4. Fetch all updated questions with subtest code
    const { data: qData, error: qErr } = await supabaseAuth
      .from('questions')
      .select('id, parameter_a, parameter_b, parameter_c, subtest_id, subtests(kode)');
    if (qErr) throw qErr;

    const qMap = new Map();
    for (const q of qData || []) {
      qMap.set(q.id, {
        ...q,
        subtest_kode: Array.isArray(q.subtests) ? q.subtests[0]?.kode : (q.subtests as any)?.kode
      });
    }

    // Group answers by session
    const sessionAnswers = new Map();
    for (const a of allAnswers) {
      if (!sessionAnswers.has(a.session_id)) {
        sessionAnswers.set(a.session_id, []);
      }
      sessionAnswers.get(a.session_id).push(a);
    }

    // 5. Recalculate scores and update exam_results
    let updatedResultsCount = 0;
    
    for (const session of sessions) {
      const answers = sessionAnswers.get(session.id) || [];
      
      const bySubtest: Record<string, { correct: boolean; params: any }[]> = {};
      
      for (const a of answers) {
        const qInfo = qMap.get(a.question_id);
        if (qInfo && qInfo.subtest_kode) {
          const kode = qInfo.subtest_kode;
          if (!bySubtest[kode]) bySubtest[kode] = [];
          bySubtest[kode].push({
            correct: a.benar === true,
            params: {
              a: Number(qInfo.parameter_a),
              b: Number(qInfo.parameter_b),
              c: Number(qInfo.parameter_c)
            }
          });
        }
      }

      const newScores: Record<string, { theta: number; score: number }> = {};
      const subtestCodes = ['PU', 'PPU', 'PBM', 'PK', 'LBI', 'LBE', 'PM'];
      for (const kode of subtestCodes) {
        if (bySubtest[kode]) {
          newScores[kode] = calculateSubtestScore(bySubtest[kode]);
        } else {
          newScores[kode] = { theta: 0, score: 0 };
        }
      }

      const lbiScore = newScores['LBI'].score;
      
      const { error: resErr } = await supabase
        .from('exam_results')
        .update({
          skor_penalaran_umum: newScores['PU'].score,
          skor_ppu: newScores['PPU'].score,
          skor_pbm: newScores['PBM'].score,
          skor_pk: newScores['PK'].score,
          skor_literasi_id: lbiScore,
          skor_literasi_id_saintek: lbiScore * 0.52,
          skor_literasi_id_soshum: lbiScore * 0.48,
          skor_literasi_en: newScores['LBE'].score,
          skor_penalaran_matematika: newScores['PM'].score,
          theta_penalaran_umum: newScores['PU'].theta,
          theta_ppu: newScores['PPU'].theta,
          theta_pbm: newScores['PBM'].theta,
          theta_pk: newScores['PK'].theta,
          theta_literasi_id: newScores['LBI'].theta,
          theta_literasi_en: newScores['LBE'].theta,
          theta_penalaran_matematika: newScores['PM'].theta,
        })
        .eq('session_id', session.id);
      
      if (!resErr) updatedResultsCount++;
    }

    return NextResponse.json({ success: true, updatedQuestions: updatedQuestionsCount, updatedResults: updatedResultsCount });

  } catch (error: any) {
    console.error('IRT Recalculation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
