import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Client } from 'pg';
import { calculateSubtestScore } from '@/lib/irt';

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Calculate P-values and update question parameter_b
    const statsRes = await client.query(`
      SELECT a.question_id,
             COUNT(*) as total_answers,
             SUM(CASE WHEN a.benar = true THEN 1 ELSE 0 END) as correct_answers
      FROM public.answers a
      JOIN public.exam_sessions s ON a.session_id = s.id
      WHERE s.status = 'completed'
      GROUP BY a.question_id
    `);

    for (const row of statsRes.rows) {
      const total = parseInt(row.total_answers);
      const correct = parseInt(row.correct_answers);
      if (total > 0) {
        let p = correct / total;
        // Clamp p to avoid infinity in log
        p = Math.max(0.01, Math.min(0.99, p));
        // Calculate b parameter: higher p means easier (lower b)
        let b = -Math.log(p / (1 - p));
        
        await client.query(
          `UPDATE public.questions SET parameter_b = $1 WHERE id = $2`,
          [b, row.question_id]
        );
      }
    }

    // 2. Fetch all updated questions
    const qRes = await client.query(`
      SELECT q.id, q.subtest_id, st.kode as subtest_kode, 
             q.parameter_a, q.parameter_b, q.parameter_c
      FROM public.questions q
      JOIN public.subtests st ON q.subtest_id = st.id
    `);
    const qMap = new Map();
    for (const q of qRes.rows) {
      qMap.set(q.id, q);
    }

    // 3. Get all completed sessions
    const sessionsRes = await client.query(`
      SELECT id, user_id FROM public.exam_sessions WHERE status = 'completed'
    `);

    // 4. Get all answers for completed sessions
    const answersRes = await client.query(`
      SELECT session_id, question_id, benar
      FROM public.answers
      WHERE session_id IN (SELECT id FROM public.exam_sessions WHERE status = 'completed')
    `);

    // Group answers by session
    const sessionAnswers = new Map();
    for (const a of answersRes.rows) {
      if (!sessionAnswers.has(a.session_id)) {
        sessionAnswers.set(a.session_id, []);
      }
      sessionAnswers.get(a.session_id).push(a);
    }

    // 5. Recalculate scores and update exam_results
    let updatedResultsCount = 0;
    
    for (const session of sessionsRes.rows) {
      const answers = sessionAnswers.get(session.id) || [];
      
      // Group by subtest
      const bySubtest: Record<string, { correct: boolean; params: any }[]> = {};
      
      for (const a of answers) {
        const qData = qMap.get(a.question_id);
        if (qData) {
          const kode = qData.subtest_kode;
          if (!bySubtest[kode]) bySubtest[kode] = [];
          bySubtest[kode].push({
            correct: a.benar === true,
            params: {
              a: parseFloat(qData.parameter_a),
              b: parseFloat(qData.parameter_b),
              c: parseFloat(qData.parameter_c)
            }
          });
        }
      }

      // Calculate new scores
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
      
      const res = await client.query(`
        UPDATE public.exam_results 
        SET 
          skor_penalaran_umum = $1, skor_ppu = $2, skor_pbm = $3, skor_pk = $4,
          skor_literasi_id = $5, skor_literasi_id_saintek = $6, skor_literasi_id_soshum = $7,
          skor_literasi_en = $8, skor_penalaran_matematika = $9,
          theta_penalaran_umum = $10, theta_ppu = $11, theta_pbm = $12, theta_pk = $13,
          theta_literasi_id = $14, theta_literasi_en = $15, theta_penalaran_matematika = $16
        WHERE session_id = $17
      `, [
        newScores['PU'].score, newScores['PPU'].score, newScores['PBM'].score, newScores['PK'].score,
        lbiScore, lbiScore * 0.52, lbiScore * 0.48,
        newScores['LBE'].score, newScores['PM'].score,
        newScores['PU'].theta, newScores['PPU'].theta, newScores['PBM'].theta, newScores['PK'].theta,
        newScores['LBI'].theta, newScores['LBE'].theta, newScores['PM'].theta,
        session.id
      ]);
      
      if (res.rowCount !== null && res.rowCount > 0) updatedResultsCount++;
    }

    await client.end();
    return NextResponse.json({ success: true, updatedQuestions: statsRes.rowCount, updatedResults: updatedResultsCount });

  } catch (error: any) {
    await client.end();
    console.error('IRT Recalculation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
