'use client';

import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Calculator from './Calculator';
import { Question, ExamSession, Subtest } from '@/types';
import { calculateSubtestScore } from '@/lib/irt';
import styles from './exam.module.css';
import LatexRenderer from './LatexRenderer';

interface AnswerMap {
  [questionId: string]: string;
}

interface FlagMap {
  [questionId: string]: boolean;
}

interface UserProfile {
  nama: string;
  nomor_peserta_utbk: string | null;
  nisn: string | null;
  asal_sekolah: string | null;
  foto_url: string | null;
}

const SUBTEST_DURATIONS: Record<string, number> = {
  PU: 30, PPU: 15, PBM: 25, PK: 20, LBI: 42, LIE: 20, PM: 42,
};

type Phase = 'agreement' | 'info' | 'waiting_approvals' | 'countdown' | 'exam' | 'subtest_transition' | 'finished_notice';

export default function ExamPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>('agreement');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subtests, setSubtests] = useState<Subtest[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flags, setFlags] = useState<FlagMap>({});
  const [currentSubtestIdx, setCurrentSubtestIdx] = useState(0);
  const [transitionNextSubtestIdx, setTransitionNextSubtestIdx] = useState<number | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showViolation, setShowViolation] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [maxChoicesAlert, setMaxChoicesAlert] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [latency, setLatency] = useState(0);
  const [ip, setIp] = useState('10.0.0.1');
  const [isExitedFullscreen, setIsExitedFullscreen] = useState(false);
  const [infoTab, setInfoTab] = useState<'info' | 'rules'>('info');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const violationsRef = useRef(0);
  const sessionRef = useRef<ExamSession | null>(null);
  const startTimeRef = useRef(Date.now());

  const currentSubtest = subtests[currentSubtestIdx];
  const subtestQuestions = questions.filter(q => q.subtest_id === currentSubtest?.id);
  const currentQuestion = subtestQuestions[currentQuestionIdx];

  useEffect(() => {
    const interval = setInterval(() => {
      const t = Date.now() - startTimeRef.current;
      setLatency(Math.floor(Math.random() * 8) + 2);
      startTimeRef.current = Date.now();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleViolation = useCallback((reason = 'Peserta meninggalkan layar ujian (Pindah Tab/Minimize)') => {
    violationsRef.current += 1;
    setViolations(violationsRef.current);
    setShowViolation(true);
    if (sessionRef.current) {
      supabase.from('exam_sessions').update({ pelanggaran: violationsRef.current }).eq('id', sessionRef.current.id).then();
      supabase.from('exam_violations').insert({
        session_id: sessionRef.current.id,
        jenis_pelanggaran: reason
      }).then();
    }
  }, [supabase]);

  useEffect(() => {
    if (phase !== 'exam') return;
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') handleViolation('Pindah tab / keluar dari halaman ujian');
    }
    function onContextMenu(e: MouseEvent) { e.preventDefault(); }
    function onKeyDown(e: KeyboardEvent) {
      // Block DevTools
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        return;
      }
      // Block Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block PrintScreen / screenshot attempts
      if (
        e.key === 'PrintScreen' ||
        e.key === 'Print' ||
        e.code === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && ['3', '4', '5', 'S'].includes(e.key)) || // Mac screenshot
        (e.ctrlKey && e.shiftKey && ['S', 'P'].includes(e.key)) ||           // Windows Snipping Tool
        (e.ctrlKey && e.key === 'p') ||                                       // Ctrl+P (print)
        (e.metaKey && e.key === 'p')                                           // Cmd+P (print)
      ) {
        e.preventDefault();
        e.stopPropagation();
        // Log screenshot attempt as violation
        if (sessionRef.current) {
          violationsRef.current += 1;
          supabase.from('exam_sessions').update({ pelanggaran: violationsRef.current }).eq('id', sessionRef.current.id).then();
          supabase.from('exam_violations').insert({
            session_id: sessionRef.current.id,
            jenis_pelanggaran: `Percobaan screenshot/print (${e.key})`
          }).then();
        }
        return;
      }
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        setIsExitedFullscreen(true);
      }
    }
    // Blur screen content when window loses focus (anti-screenshot)
    function onWindowBlur() {
      const overlay = document.getElementById('exam-blur-overlay');
      if (overlay) overlay.style.display = 'flex';
      // Also count as violation (minimize / switch to another window)
      handleViolation('Minimize atau pindah ke jendela/aplikasi lain');
    }
    function onWindowFocus() {
      const overlay = document.getElementById('exam-blur-overlay');
      if (overlay) overlay.style.display = 'none';
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown, true); // capture phase to intercept first
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [phase, handleViolation, supabase]);

  const submitExam = useCallback(async (sessionData: ExamSession, questionsData: Question[], answersData: AnswerMap) => {
    setSubmitting(true);
    const subtestScores: Record<string, { theta: number; score: number }> = {};

    for (const st of subtests) {
      const stQuestions = questionsData.filter(q => q.subtest_id === st.id);
      const responses = stQuestions.map(q => ({
        correct: answersData[q.id] === q.kunci_jawaban,
        params: { a: Number(q.parameter_a), b: Number(q.parameter_b), c: Number(q.parameter_c) },
      }));
      subtestScores[st.kode] = calculateSubtestScore(responses);
    }

    const answersToInsert = questionsData.map(q => ({
      session_id: sessionData.id,
      question_id: q.id,
      jawaban_user: answersData[q.id] || null,
      benar: answersData[q.id] ? answersData[q.id] === q.kunci_jawaban : null,
    }));
    await supabase.from('answers').upsert(answersToInsert, { onConflict: 'session_id,question_id' });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const lbiScore = subtestScores['LBI']?.score ?? 0;
    await supabase.from('exam_results').insert({
      user_id: user.id,
      session_id: sessionData.id,
      skor_penalaran_umum: subtestScores['PU']?.score ?? 0,
      skor_ppu: subtestScores['PPU']?.score ?? 0,
      skor_pbm: subtestScores['PBM']?.score ?? 0,
      skor_pk: subtestScores['PK']?.score ?? 0,
      skor_literasi_id: lbiScore,
      skor_literasi_id_saintek: lbiScore * 0.52,
      skor_literasi_id_soshum: lbiScore * 0.48,
      skor_literasi_en: subtestScores['LIE']?.score ?? 0,
      skor_penalaran_matematika: subtestScores['PM']?.score ?? 0,
      theta_penalaran_umum: subtestScores['PU']?.theta ?? 0,
      theta_ppu: subtestScores['PPU']?.theta ?? 0,
      theta_pbm: subtestScores['PBM']?.theta ?? 0,
      theta_pk: subtestScores['PK']?.theta ?? 0,
      theta_literasi_id: subtestScores['LBI']?.theta ?? 0,
      theta_literasi_en: subtestScores['LIE']?.theta ?? 0,
      theta_penalaran_matematika: subtestScores['PM']?.theta ?? 0,
      tanggal_selesai: new Date().toISOString(),
    });

    await supabase.from('exam_sessions').update({
      status: 'completed',
      waktu_selesai: new Date().toISOString(),
    }).eq('id', sessionData.id);

    router.push('/dashboard');
  }, [supabase, subtests, router]);

  useEffect(() => {
    async function load() {
      if (typeof window !== 'undefined') {
        setTutorialCompleted(localStorage.getItem('tutorialCompleted') === 'true');
        if (sessionStorage.getItem('hasAgreed') === 'true') {
          setPhase('info');
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from('profiles').select('nama, nomor_peserta_utbk, nisn, asal_sekolah, foto_url').eq('id', user.id).single(),
        supabase.from('exam_sessions').select('*').eq('user_id', user.id).eq('status', 'ongoing').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (!sessionRes.data) { router.push('/dashboard'); return; }

      setProfile(profileRes.data);
      setSession(sessionRes.data);
      sessionRef.current = sessionRes.data;

      const [subtestsRes, questionsRes, existingAnswers] = await Promise.all([
        supabase.from('subtests').select('*').order('urutan'),
        supabase.from('questions').select('*').order('nomor'),
        supabase.from('answers').select('question_id, jawaban_user').eq('session_id', sessionRes.data.id),
      ]);

      const answerMap: AnswerMap = {};
      existingAnswers.data?.forEach(a => {
        if (a.jawaban_user) answerMap[a.question_id] = a.jawaban_user;
      });

      setSubtests(subtestsRes.data ?? []);
      const rawQuestions = questionsRes.data ?? [];

      // Shuffle questions per-user using seeded Fisher-Yates shuffle
      // Seed = sum of user ID char codes so same user always gets same order (deterministic)
      const seed = Array.from(sessionRes.data.user_id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      function seededRandom(s: number) {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      }
      function shuffleWithSeed<T>(arr: T[], seedVal: number): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(seededRandom(seedVal + i) * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
      // Shuffle within each subtest (keep subtests in order, shuffle questions inside)
      const shuffledQuestions = (subtestsRes.data ?? []).flatMap(st => {
        const stQs = rawQuestions.filter(q => q.subtest_id === st.id);
        return shuffleWithSeed(stQs, seed + st.urutan);
      });

      setQuestions(shuffledQuestions);
      setAnswers(answerMap);

      const firstSubtest = subtestsRes.data?.[0];
      if (firstSubtest) setTimeLeft(SUBTEST_DURATIONS[firstSubtest.kode] * 60);

      setLoading(false);
    }
    load();
  }, [supabase, router]);

  useEffect(() => {
    if (loading || phase !== 'exam' || !currentSubtest) return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (currentSubtestIdx < subtests.length - 1) {
            setTransitionNextSubtestIdx(currentSubtestIdx + 1);
            setPhase('subtest_transition');
            setCountdownTimer(30);
          } else {
            setPhase('finished_notice');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { timerRef.current && clearInterval(timerRef.current); };
  }, [loading, phase, currentSubtest, currentSubtestIdx, subtests, session, questions, answers, submitExam]);

  function saveAnswer(questionId: string, answer: string) {
    const q = questions.find(q => q.id === questionId);
    if (!q) return;

    // Is it a multiple-select checkbox question (where key has > 1 letter, e.g. "AD")?
    const isMulti = q.kunci_jawaban.length > 1;

    let finalAnswer = answer;
    if (isMulti) {
      const currentSelections = answers[questionId] ? answers[questionId].split(',') : [];
      if (currentSelections.includes(answer)) {
        // Toggle off
        finalAnswer = currentSelections.filter(x => x !== answer).sort().join(',');
      } else {
        // Limit checkbox choices to maximum 2
        if (currentSelections.length >= 2) {
          setMaxChoicesAlert(true);
          return;
        }
        finalAnswer = [...currentSelections, answer].sort().join(',');
      }
    }

    setAnswers(prev => ({ ...prev, [questionId]: finalAnswer }));
    supabase.from('answers').upsert({
      session_id: session!.id,
      question_id: questionId,
      jawaban_user: finalAnswer || null,
      benar: finalAnswer === q.kunci_jawaban,
    }, { onConflict: 'session_id,question_id' });
  }

  function toggleFlag(questionId: string) {
    setFlags(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  function formatTime(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }

  function pad(n: number) { return String(n).padStart(2, '0'); }

  function goToSubtest(idx: number) {
    setTransitionNextSubtestIdx(idx);
    setPhase('subtest_transition');
    setCountdownTimer(30);
  }

  const [zoomFactor, setZoomFactor] = useState(100);
  const [countdownTimer, setCountdownTimer] = useState(30);

  // Manage pre-exam and post-subtest countdowns
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'subtest_transition') return;
    const cd = setInterval(() => {
      setCountdownTimer(prev => {
        if (prev <= 1) {
          clearInterval(cd);
          if (phase === 'subtest_transition' && transitionNextSubtestIdx !== null) {
            setCurrentSubtestIdx(transitionNextSubtestIdx);
            setCurrentQuestionIdx(0);
            const next = subtests[transitionNextSubtestIdx];
            if (next) setTimeLeft(SUBTEST_DURATIONS[next.kode] * 60);
            setTransitionNextSubtestIdx(null);
          }
          setPhase('exam');
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cd);
  }, [phase, transitionNextSubtestIdx, subtests]);

  function startExam() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setPhase('countdown');
  }

  const answeredCount = subtestQuestions.filter(q => answers[q.id]).length;
  const timerDanger = timeLeft < 120;

  if (loading) {
    return (
      <div className={styles.loader}>
        <div className={styles.loaderBox}>
          <div className={styles.loaderLogo}>DAILY STUDY</div>
          <p>Memuat soal ujian...</p>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className={styles.loader}>
        <div className={styles.loaderBox}>
          <div className={styles.loaderLogo}>DAILY STUDY</div>
          <p>Mengirim jawaban dan menghitung skor...</p>
        </div>
      </div>
    );
  }

  if (phase === 'agreement') {
    return (
      <div className={styles.preScreen}>
        <div className={styles.preHeader}>
          
          
        </div>
        <div className={styles.agreementBox}>
          <h2 className={styles.agreementTitle}>Persetujuan</h2>
          <div className={styles.agreementText}>
            <p>
              Saya menyatakan menjunjung tinggi tata tertib dan peraturan pelaksanaan UTBK. Apabila pada saat ujian,
              saya melakukan tindakan-tindakan yang dinilai oleh pengawas melanggar aturan tersebut, saya menerima
              keputusan bahwa saya dinyatakan <strong>GAGAL</strong> pada ujian saya. Pernyataan ini saya buat dengan
              sadar dan penuh tanggung jawab.
            </p>
          </div>
          <div className={styles.agreementActions}>
            <button className={styles.btnReject} onClick={() => router.push('/dashboard')}>
              Tidak Setuju
            </button>
            <button className={styles.btnAccept} onClick={() => {
              sessionStorage.setItem('hasAgreed', 'true');
              setPhase('info');
            }}>
              Setuju
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'info') {
    return (
      <div className={styles.infoScreen}>
        <div className={styles.infoSidebar}>
          <div className={styles.infoSidebarHeader}>
            <div style={{ color: '#00a3e8', fontWeight: 900, fontSize: '18px' }}>DAILY STUDY</div>
            <div style={{ color: '#666', fontSize: '10px' }}>TRYOUT SNBT 2027</div>
          </div>
          <div className={styles.infoSidebarMenu}>
            <div className={styles.infoSidebarItem} style={{ color: '#ccc' }}>Beranda</div>
            <div className={`${styles.infoSidebarItem} ${infoTab === 'rules' ? styles.infoSidebarItemActive : ''}`} onClick={() => setInfoTab('rules')}>Petunjuk & Tata Tertib</div>
            <div className={`${styles.infoSidebarItem} ${infoTab === 'info' ? styles.infoSidebarItemActive : ''}`} onClick={() => setInfoTab('info')}>Login Peserta</div>
            <div className={styles.infoSidebarItem} style={{ color: '#ccc' }}>Keluar</div>
          </div>
        </div>
        
        <div className={styles.infoMain}>
          <div className={styles.infoMainHeader}>
            <div>
              <div style={{ fontWeight: 700, color: '#333', fontSize: '16px' }}>{infoTab === 'info' ? 'Informasi Peserta' : 'Petunjuk & Tata Tertib'}</div>
              <div style={{ color: '#888', fontSize: '12px' }}>{infoTab === 'info' ? 'Informasi Peserta UTBK' : 'Petunjuk & Tata Tertib Sebelum Ujian, Saat Ujian, dan Sesudah Ujian'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#333' }}>UTBK <span style={{ color: '#00a3e8' }}>10.6.6.22</span></div>
              <div style={{ fontSize: '10px', color: '#888' }}>Versi 21.05</div>
            </div>
          </div>
          
          {infoTab === 'info' ? (
          <div className={styles.infoContentWrap}>
            <div className={styles.infoLeftCard}>
              <div className={styles.infoLeftCardBody}>
                <div className={styles.infoPhotoWrap}>
                  {profile?.foto_url
                    ? <img src={profile.foto_url} alt="Foto peserta" className={styles.infoPhotoImg} />
                    : <div className={styles.infoPhotoImgPlaceholder}>{profile?.nama?.[0]?.toUpperCase()}</div>
                  }
                </div>
                <div className={styles.infoDetails}>
                  <div className={styles.infoDetailGroup}>
                    <div className={styles.infoDetailLabel}>Nomor Peserta</div>
                    <div className={styles.infoDetailValue}>{profile?.nomor_peserta_utbk ?? '-'}</div>
                  </div>
                  <div className={styles.infoDetailGroup}>
                    <div className={styles.infoDetailLabel}>Nama</div>
                    <div className={styles.infoDetailValue}>{profile?.nama ?? '-'}</div>
                  </div>
                  <div className={styles.infoDetailGroup}>
                    <div className={styles.infoDetailLabel}>Sesi Ujian</div>
                    <div className={styles.infoDetailValue}>2027-02-10 06:30:00</div>
                  </div>
                  <div className={styles.infoDetailGroup}>
                    <div className={styles.infoDetailLabel}>Ruang Ujian Dummy 302</div>
                    <div className={styles.infoDetailValue}>FPRK-4<br/>Test Center Dummy</div>
                  </div>
                </div>
              </div>
              <div className={styles.infoLeftCardFooter}>
                <button className={styles.infoBtnOutline} onClick={() => setPhase('agreement')}>&lt; Kembali</button>
              </div>
            </div>
            
            <div className={styles.infoRightCard}>
              <div className={styles.infoActionSection}>
                <div className={styles.infoActionIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div className={styles.infoActionTitle}>Tutorial Ujian</div>
                <button className={styles.infoBtnTeal} onClick={() => router.push('/exam/tutorial')}>Tutorial Ujian</button>
                <div className={styles.infoActionDesc}>Tutorial penggunaan aplikasi ketika ujian sedang berlangsung</div>
              </div>
              
              <div className={styles.infoActionDivider}>ATAU</div>
              
              <div className={styles.infoActionSection}>
                <div className={styles.infoActionIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div className={styles.infoActionTitle}>Mulai Ujian</div>
                <button 
                  className={styles.infoBtnTeal} 
                  onClick={() => setPhase('waiting_approvals')}
                  disabled={!tutorialCompleted}
                  style={{ opacity: tutorialCompleted ? 1 : 0.5, cursor: tutorialCompleted ? 'pointer' : 'not-allowed' }}
                >
                  Mulai Ujian
                </button>
                <div className={styles.infoActionDesc}>Untuk memulai ujian, jika Anda belum mengerti penggunaan aplikasi ujian, silahkan Anda mencoba Tutorial Ujian terlebih dahulu</div>
              </div>
            </div>
          </div>
          ) : (
          <div className={styles.rulesContentWrap}>
            <div className={styles.rulesCard}>
              <div className={styles.rulesAlert}>
                <strong>Setiap pelanggaran terhadap TATA TERTIB UJIAN, akan mengakibatkan peserta DIBATALKAN ujiannya</strong>
              </div>
              
              <div className={styles.rulesSection}>
                <h3 className={styles.rulesSectionTitle}>SEBELUM UJIAN UTBK BERLANGSUNG</h3>
                <ol className={styles.rulesList}>
                  <li>Peserta ujian harus sudah mengetahui RUANG UJIAN dan LOKASI UJIAN sehari sebelum ujian berlangsung.</li>
                  <li>Peserta harus membawa:
                    <ol type="a">
                      <li>Kartu Tanda Peserta Ujian.</li>
                      <li>Fotocopy Ijazah SMA/SMK/MA atau sederajat dan sudah dilegalisasi atau Surat Keterangan sedang kelas XII dari Kepala Sekolah yang dilengkapi dengan Pasfoto berwarna terbaru yang bersangkutan dan dibubuhi cap sekolah atau Kartu Identitas (Asli).</li>
                    </ol>
                  </li>
                  <li>Peserta dilarang mengenakan Kaos Oblong (T-Shirt).</li>
                  <li>Peserta harus bersepatu.</li>
                  <li>Peserta harus datang ke lokasi ujian paling lambat 30 menit sebelum ujian dimulai. Keterlambatan dengan alasan apapun sejak waktu tes dimulai, Peserta TIDAK DIPERBOLEHKAN mengikuti ujian.</li>
                  <li>Peserta tidak diperbolehkan masuk ruang ujian sebelum ada tanda untuk memasuki ruang ujian.</li>
                  <li>Peserta tidak diperbolehkan membawa daftar logaritma, segala jenis kalkulator, kertas, buku maupun catatan lain, alat komunikasi seperti telepon seluler, jam tangan (arloji), kamera, modem, segala jenis alat elektronik untuk merekam dan sebagainya.</li>
                  <li>Peserta <strong>TIDAK DIPERBOLEHKAN</strong> bekerja sama dengan pihak manapun dengan berkomunikasi secara langsung dan tidak langsung terkait dengan pelaksanaan ujian dengan metode komunikasi apapun.</li>
                  <li>Tas, buku, dan catatan dalam bentuk apapun dikumpulkan di tempat yang telah ditentukan.</li>
                  <li>Peserta akan digeledah jika dianggap ada sesuatu hal yang mencurigakan.</li>
                  <li>Peserta harus duduk di tempat yang sudah ditentukan sesuai dengan nomor peserta dan nomor meja, tidak diperbolehkan menempati tempat duduk lain.</li>
                  <li>Peserta meletakkan Kartu Tanda Peserta Ujian dengan foto menghadap ke atas.</li>
                  <li>Peserta mengisi daftar hadir dengan menggunakan alat tulis yang telah disediakan.</li>
                  <li>Peserta yang kehilangan Kartu Tanda Peserta Ujian harus segera melaporkan diri kepada Pengawas Ujian.</li>
                  <li>Peserta memasukan Nomor Peserta dan NISN Peserta sebagai PIN Peserta.</li>
                  <li>Melakukan Tutorial Ujian UTBK sesuai dengan waktu yang telah disediakan agar peserta mengetahui cara menggunakan aplikasi.</li>
                </ol>
              </div>

              <div className={styles.rulesSection}>
                <h3 className={styles.rulesSectionTitle}>SAAT MENGERJAKAN UJIAN UTBK</h3>
                <ol className={styles.rulesList}>
                  <li>Membaca dengan seksama petunjuk mengerjakan ujian yang sudah tersedia pada aplikasi ujian.</li>
                  <li>Mengecek kesesuaian identitas yang tampil di layar perangkat dan klik kesesuaian identitas jika telah sesuai.</li>
                  <li>Pada halaman Informasi Ujian, perhatikan Komponen Ujian dan Waktu Ujian dengan seksama, dan tekan tombol Mulai Ujian.</li>
                  <li>Mengerjakan soal sesuai dengan lama waktu pengerjaan.</li>
                  <li>Menjawab butir soal, dengan cara memilih/meng-klik opsi jawaban menggunakan mouse.</li>
                  <li>Peserta dapat mengubah pilihan jawaban dengan cara memilih/meng-klik pilihan jawaban lain yang dianggap benar. Jawaban peserta otomatis akan terganati dengan pilihan jawaban yang terakhir.</li>
                  <li>Peserta dapat mengidentifikasi kelengkapan jawaban pada daftar soal di sisi kiri layar monitor. Soal-soal yang belum dijawab ditandai dengan kotak warna merah dan soal-soal yang sudah dikerjakan ditandai dengan kotak warna penuh.</li>
                  <li>Selama ujian berlangsung, peserta <strong>TIDAK DIPERBOLEHKAN</strong>:
                    <ol type="a">
                      <li>Menanyakan jawaban soal kepada siapa pun.</li>
                      <li>Bekerjasama atau berkomunikasi (berbicara) dengan peserta lain.</li>
                      <li>Bekerjasama atau berkomunikasi (berbicara/terhubung) dengan pihak luar.</li>
                      <li>Memberi dan atau menerima bantuan dalam menjawab soal ujian.</li>
                      <li>Memperlihatkan pekerjaan/jawaban sendiri kepada peserta lain atau melihat pekerjaan/jawaban peserta lain.</li>
                      <li>Meninggalkan ruang ujian selama ujian berlangsung, kecuali seizin pengawas ujian.</li>
                      <li>Menggantikan atau digantikan oleh orang lain.</li>
                      <li>Menyalin dan atau merekam soal ujian dengan menggunakan media apa pun.</li>
                    </ol>
                  </li>
                  <li>Apabila Peserta melakukan kecurangan pada Poin 8 (a hingga h) dan 9, formasi pelanggaran yang bersangkutan akan dicatat di dalam Berita Acara Pelaksaan Ujian (BAPU).</li>
                  <li>Aplikasi UTBK akan berhenti secara otomatis ketika waktu tes berakhir dan peserta wajib klik tombol 'OK'.</li>
                  <li>Peserta yang meninggalkan ruangan setelah menekan tombol Mulai Ujian (Memulai Ujian) dan karena satu dan lain hal tidak kembali lagi hingga waktu ujian berakhir, dinyatakan telah selesai menempuh ujian UTBK.</li>
                </ol>
              </div>

              <div className={styles.rulesSection}>
                <h3 className={styles.rulesSectionTitle}>SESUDAH MENGERJAKAN UJIAN UTBK</h3>
                <ol className={styles.rulesList}>
                  <li>Peserta UTBK meninggalkan ruangan pada waktu yang bersamaan mengikuti instruksi panitia.</li>
                  <li>Peserta UTBK yang telah selesai mengerjakan soal sebelum waktu ujian selesai, tidak diperbolehkan meninggalkan ruangan.</li>
                  <li>Peserta UTBK dilarang meninggalkan tempat duduk sebelum diinstruksikan oleh Pengawas UTBK.</li>
                </ol>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'waiting_approvals') {
    return (
      <div className={styles.preScreen}>
        <div className={styles.preHeader}>
          <img src="/logo.png" alt="DAILY STUDY" className={styles.preHeaderLogo} />
          
          
          <span className={styles.preHeaderUtbk}>Tryout UTBK 2027</span>
          <span className={styles.preHeaderIp}>{ip}</span>
        </div>
        <div className={styles.infoCard}>
          <h2 className={styles.infoTitle}>Mulai Ujian</h2>
          <div className={styles.approvalAlert}>
            <strong>Petunjuk Ujian:</strong> Baca dan ikuti petunjuk ujian. Untuk memulai ujian klik tombol Mulai Ujian di bawah.
          </div>
          <div className="table-wrapper" style={{ marginTop: '20px' }}>
            <table>
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Nama Subtes</th>
                  <th>Jumlah Soal</th>
                  <th>Sisa Waktu</th>
                </tr>
              </thead>
              <tbody>
                {subtests.map((st, idx) => (
                  <tr key={st.id}>
                    <td>{idx + 1}</td>
                    <td>{st.nama}</td>
                    <td>{st.kode === 'PU' || st.kode === 'LBI' ? 30 : 20}</td>
                    <td>{SUBTEST_DURATIONS[st.kode]} Menit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button className={styles.btnReject} onClick={() => setPhase('info')}>Kembali</button>
            <button className={styles.btnMulai} onClick={startExam}>Mulai Ujian</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className={styles.preScreen}>
        <div className={styles.preHeader}>
          <img src="/logo.png" alt="DAILY STUDY" className={styles.preHeaderLogo} />
        </div>
        <div className={styles.infoCard}>
          <h2 className={styles.infoTitle} style={{ textAlign: 'center', color: '#00a3e8', marginBottom: '8px' }}>Ujian Tulis Berbasis Komputer</h2>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ border: '1px solid #ccc', padding: '2px 8px', fontSize: '12px', borderRadius: '4px' }}>Versi 6.2.5</span>
          </div>
          
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Nama</th>
                  <th style={{ textAlign: 'center' }}>Jumlah Soal</th>
                  <th style={{ textAlign: 'center' }}>Durasi</th>
                  <th style={{ textAlign: 'center' }}>Sisa Waktu</th>
                </tr>
              </thead>
              <tbody>
                {subtests.map((st, idx) => {
                  const isFirst = idx === 0;
                  const rowColor = isFirst ? '#000' : '#aaa';
                  const rowBg = isFirst ? '#f5f5f5' : 'transparent';
                  return (
                    <Fragment key={st.id}>
                      <tr style={{ background: rowBg, fontWeight: isFirst ? 'bold' : 'normal', color: rowColor }}>
                        <td style={{ padding: '12px', borderBottom: isFirst ? 'none' : '1px solid #eee' }}>{idx + 1}</td>
                        <td style={{ padding: '12px', borderBottom: isFirst ? 'none' : '1px solid #eee' }}>{st.nama.toUpperCase()}</td>
                        <td style={{ textAlign: 'center', padding: '12px', borderBottom: isFirst ? 'none' : '1px solid #eee' }}>{st.kode === 'PU' || st.kode === 'LBI' ? 30 : st.kode === 'PK' ? 15 : 20}</td>
                        <td style={{ textAlign: 'center', padding: '12px', borderBottom: isFirst ? 'none' : '1px solid #eee' }}>{SUBTEST_DURATIONS[st.kode]} Menit</td>
                        <td style={{ textAlign: 'center', padding: '12px', borderBottom: isFirst ? 'none' : '1px solid #eee' }}>{SUBTEST_DURATIONS[st.kode]} Menit 0 Detik</td>
                      </tr>
                      {isFirst && (
                        <tr>
                          <td colSpan={5} style={{ padding: '0 16px 16px 16px', fontSize: '12px', lineHeight: 1.5, color: '#333', background: rowBg, borderBottom: '1px solid #eee' }}>
                            Bagian ini akan menguji kemampuan Anda pada subtes {st.nama}. Silakan kerjakan soal dengan teliti dan perhatikan waktu yang tersisa. Pastikan Anda telah membaca semua petunjuk pengisian sebelum mulai menjawab soal.
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '32px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Dimulai Dalam</div>
            <div style={{ border: '2px solid #00a3e8', color: '#00a3e8', padding: '8px 24px', fontSize: '20px', fontWeight: 'bold', borderRadius: '4px' }}>
              00:{pad(countdownTimer)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'subtest_transition') {
    return (
      <div className={styles.preScreen}>
        <div className={styles.preHeader}>
          <img src="/logo.png" alt="DAILY STUDY" className={styles.preHeaderLogo} />
        </div>
        <div className={styles.infoCard}>
          <h2 className={styles.infoTitle} style={{ textAlign: 'center', color: '#00a3e8', marginBottom: '8px' }}>Ujian Tulis Berbasis Komputer</h2>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ border: '1px solid #ccc', padding: '2px 8px', fontSize: '12px', borderRadius: '4px' }}>Versi 6.2.5</span>
          </div>
          
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Nama</th>
                  <th style={{ textAlign: 'center' }}>Jumlah Soal</th>
                  <th style={{ textAlign: 'center' }}>Durasi</th>
                  <th style={{ textAlign: 'center' }}>Sisa Waktu</th>
                </tr>
              </thead>
              <tbody>
                {subtests.map((st, idx) => {
                  const isCompleted = idx < (transitionNextSubtestIdx ?? 0);
                  const isNext = idx === transitionNextSubtestIdx;
                  const rowColor = isCompleted ? '#28a745' : (isNext ? '#000' : '#aaa');
                  const rowBg = isNext ? '#f5f5f5' : 'transparent';
                  return (
                    <Fragment key={st.id}>
                      <tr style={{ background: rowBg, fontWeight: isNext ? 'bold' : 'normal', color: rowColor }}>
                        <td style={{ padding: '12px', borderBottom: isNext ? 'none' : '1px solid #eee' }}>{idx + 1}</td>
                        <td style={{ padding: '12px', borderBottom: isNext ? 'none' : '1px solid #eee' }}>{st.nama.toUpperCase()}</td>
                        <td style={{ textAlign: 'center', padding: '12px', borderBottom: isNext ? 'none' : '1px solid #eee' }}>{st.kode === 'PU' || st.kode === 'LBI' ? 30 : st.kode === 'PK' ? 15 : 20}</td>
                        <td style={{ textAlign: 'center', padding: '12px', borderBottom: isNext ? 'none' : '1px solid #eee' }}>{SUBTEST_DURATIONS[st.kode]} Menit</td>
                        <td style={{ textAlign: 'center', padding: '12px', borderBottom: isNext ? 'none' : '1px solid #eee' }}>{isCompleted ? '0 Detik' : `${SUBTEST_DURATIONS[st.kode]} Menit 0 Detik`}</td>
                      </tr>
                      {isNext && (
                        <tr>
                          <td colSpan={5} style={{ padding: '0 16px 16px 16px', fontSize: '12px', lineHeight: 1.5, color: '#333', background: rowBg, borderBottom: '1px solid #eee' }}>
                            Bagian ini akan menguji kemampuan Anda pada subtes {st.nama}. Silakan kerjakan soal dengan teliti dan perhatikan waktu yang tersisa. Pastikan Anda telah membaca semua petunjuk pengisian sebelum mulai menjawab soal.
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '32px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Dimulai Dalam</div>
            <div style={{ border: '2px solid #00a3e8', color: '#00a3e8', padding: '8px 24px', fontSize: '20px', fontWeight: 'bold', borderRadius: '4px' }}>
              00:{pad(countdownTimer)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'finished_notice') {
    return (
      <div className={styles.preScreen}>
        <div className={styles.preHeader}>
          <img src="/logo.png" alt="DAILY STUDY" className={styles.preHeaderLogo} />
          
          
        </div>
        <div className={styles.infoCard} style={{ textAlign: 'center', maxWidth: '500px', marginTop: '80px' }}>
          <h2 className={styles.infoTitle}>Ujian Telah Selesai</h2>
          <p style={{ color: '#444', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
            Terima kasih telah mengikuti simulasi ujian Tryout UTBK 2027. Seluruh jawaban Anda telah tersimpan dengan aman di server utama.
          </p>
          <button className={styles.btnAccept} style={{ margin: '0 auto' }} onClick={() => session && submitExam(session, questions, answers)}>
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.examLayout} style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()}>
      
      {/* Anti-screenshot blur overlay - shown when window loses focus */}
      <div
        id="exam-blur-overlay"
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '1.2rem',
          fontWeight: 600,
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '3rem' }}>🔒</span>
        <p>Layar ujian disembunyikan</p>
        <p style={{ fontSize: '0.9rem', fontWeight: 400, color: '#aaa' }}>Klik di sini untuk melanjutkan ujian</p>
      </div>

      {isExitedFullscreen && (
        <div className={styles.violationOverlay} style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <div className={styles.violationBox} style={{ maxWidth: '600px', textAlign: 'center' }}>
            <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>PERINGATAN!</h2>
            <p style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '24px' }}>
              Anda terdeteksi keluar dari mode layar penuh (Full Screen). 
              Untuk menjaga integritas ujian, Anda tidak diperkenankan untuk keluar dari layar penuh sebelum ujian selesai.
            </p>
            <button className={styles.btnAccept} style={{ padding: '12px 24px', fontSize: '16px' }} onClick={() => {
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().then(() => {
                  setIsExitedFullscreen(false);
                }).catch(() => {});
              }
            }}>
              KEMBALI KE LAYAR PENUH
            </button>
          </div>
        </div>
      )}

      {connectionFailed && (
        <div className={styles.violationOverlay}>
          <div className={styles.violationBox} style={{ maxWidth: '550px' }}>
            <h3>Perhatian</h3>
            <p style={{ fontFamily: 'monospace', fontSize: '13px', background: '#f8f9fa', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
              Koneksi perangkat ke server terputus, pertanyaan yang sudah dijawab dan sisa waktu ujian otomatis telah tersimpan pada server.
              <br /><strong>CONNECTION_FAILED</strong>
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: '16px' }}>
              <button className={styles.btnReject} onClick={() => router.push('/dashboard')}>Keluar</button>
              <button className={styles.btnAccept} onClick={() => setConnectionFailed(false)}>Coba Lagi</button>
            </div>
          </div>
        </div>
      )}

      {maxChoicesAlert && (
        <div className={styles.violationOverlay}>
          <div className={styles.violationBox}>
            <h3>Perhatian</h3>
            <p>Soal ini dibatasi jumlah pilihannya. Silahkan hapus centang pada pilihan lain terlebih dahulu jika ingin memilih pilihan yang lainnya.</p>
            <button className={styles.btnMulai} onClick={() => setMaxChoicesAlert(false)}>Tutup</button>
          </div>
        </div>
      )}

      {showViolation && (
        <div className={styles.violationOverlay}>
          <div className={styles.violationBox}>
            <h3>Peringatan!</h3>
            <p>Anda terdeteksi meninggalkan layar ujian. Pelanggaran ke-{violations} tercatat.</p>
            <button className={styles.btnMulai} onClick={() => setShowViolation(false)}>Kembali ke Ujian</button>
          </div>
        </div>
      )}

      {showSubmitConfirm && (
        <div className={styles.violationOverlay}>
          <div className={styles.violationBox}>
            <h3>Konfirmasi Selesai</h3>
            <p>Yakin ingin mengakhiri ujian? Jawaban yang belum diisi dianggap tidak dijawab.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className={styles.btnReject} onClick={() => setShowSubmitConfirm(false)}>Batal</button>
              <button className={styles.btnAccept} onClick={() => session && submitExam(session, questions, answers)}>Ya, Selesai</button>
            </div>
          </div>
        </div>
      )}

      <header className={styles.examHeader}>
        <div className={styles.examHeaderLeft}>
          <img src="/logo.png" alt="DAILY STUDY" className={styles.headerLogo} />
          
        </div>
        <div className={styles.examHeaderCenter}>
          {currentSubtest?.nama}
          {currentSubtest?.kode === 'PK' && (
            <button 
              onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
              style={{
                marginLeft: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                background: isCalculatorOpen ? '#e0e0e0' : '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#333',
                cursor: 'pointer'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                <line x1="8" y1="6" x2="16" y2="6"></line>
                <line x1="16" y1="14" x2="16" y2="14.01"></line>
                <line x1="16" y1="10" x2="16" y2="10.01"></line>
                <line x1="16" y1="18" x2="16" y2="18.01"></line>
                <line x1="12" y1="14" x2="12" y2="14.01"></line>
                <line x1="12" y1="10" x2="12" y2="10.01"></line>
                <line x1="12" y1="18" x2="12" y2="18.01"></line>
                <line x1="8" y1="14" x2="8" y2="14.01"></line>
                <line x1="8" y1="10" x2="8" y2="10.01"></line>
                <line x1="8" y1="18" x2="8" y2="18.01"></line>
              </svg>
              Kalkulator
            </button>
          )}
        </div>
        <div className={styles.examHeaderRight}>
          <span className={styles.headerMeta}>Tryout UTBK 2027</span>
          <span className={styles.headerIp}>{ip}</span>
          <span className={styles.headerLatency}>{latency} ms</span>
          <span className={`${styles.timer} ${timerDanger ? styles.timerDanger : ''}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </header>

      <div className={styles.examBody} style={{ position: 'relative' }}>
        {isCalculatorOpen && currentSubtest?.kode === 'PK' && (
          <Calculator onClose={() => setIsCalculatorOpen(false)} />
        )}
        <aside className={styles.examSidebar}>
          <div className={styles.sidebarPhoto}>
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="Foto" className={styles.sidePhoto} />
              : <div className={styles.sidePhotoPlaceholder}>{profile?.nama?.[0]?.toUpperCase()}</div>
            }
            <div className={styles.sideNomor}>{profile?.nomor_peserta_utbk ?? '-'}</div>
            <div className={styles.sideName}>{profile?.nama}</div>
          </div>

          <div className={styles.sidebarSubtestInfo}>
            <div className={styles.sideSubtestLabel}>Tryout UTBK 2027</div>
            <div className={styles.sideSubtestName}>{currentSubtest?.nama}</div>
          </div>

          <div className={styles.sidebarPaletteSection}>
            <div className={styles.paletteLegend}>
              <span className={styles.legendAnswered}>Dijawab</span>
              <span className={styles.legendUnanswered}>Belum</span>
              <span className={styles.legendFlagged}>Ragu</span>
            </div>

            <div className={styles.palette}>
              {subtestQuestions.map((q, idx) => {
                const answered = !!answers[q.id];
                const flagged = flags[q.id];
                const current = idx === currentQuestionIdx;
                return (
                  <button
                    key={q.id}
                    className={`${styles.paletteBtn} ${current ? styles.paletteCurrent : ''} ${flagged ? styles.paletteFlagged : answered ? styles.paletteAnswered : ''}`}
                    onClick={() => setCurrentQuestionIdx(idx)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.sidebarProgress}>
            <span>{answeredCount}/{subtestQuestions.length} dijawab</span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: subtestQuestions.length > 0 ? `${(answeredCount / subtestQuestions.length) * 100}%` : '0%' }} />
            </div>
          </div>
        </aside>

        <main className={styles.examMain}>
          {currentQuestion ? (
            <div className={styles.questionArea}>
              <div className={styles.questionHeader}>
                <span className={styles.questionNum}>Soal Nomor {currentQuestionIdx + 1}</span>
                <span className={styles.questionOf}>dari {subtestQuestions.length} soal</span>
                {flags[currentQuestion.id] && <span className={styles.flaggedBadge}>Ragu-ragu</span>}
              </div>

              <LatexRenderer
                content={currentQuestion.konten}
                className={styles.questionText}
                style={{ fontSize: `${zoomFactor}%` }}
              />

              {currentQuestion.gambar_url && (
                <div className={styles.questionImageBox}>
                  <img src={currentQuestion.gambar_url} alt="Gambar soal" />
                </div>
              )}

              {/* Check if choices exist, if not render short answer input */}
              {(!currentQuestion.pilihan_a && !currentQuestion.pilihan_b) ? (
                <div className={styles.shortAnswerContainer}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                    Jawaban Anda:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ maxWidth: '300px' }}
                    placeholder="Ketik jawaban singkat disini..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => saveAnswer(currentQuestion.id, e.target.value)}
                  />
                </div>
              ) : currentQuestion.pilihan_a?.startsWith('[KOMPLEKS]') ? (
                <div className={styles.complexMatrix}>
                  <table className={styles.matrixTable}>
                    <thead>
                      <tr>
                        <th>Pernyataan</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Benar / Mempengaruhi</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Salah / Tidak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['A', 'B', 'C', 'D', ...(currentQuestion.pilihan_e ? ['E'] : [])] as string[]).map(letter => {
                        const key = `pilihan_${letter.toLowerCase()}` as keyof Question;
                        const rawText = currentQuestion[key] as string;
                        if (!rawText) return null;
                        const statementText = rawText.replace('[KOMPLEKS]', '').trim();
                        
                        const currentVal = answers[currentQuestion.id] || '';
                        const pairArray = currentVal.split(',');
                        const matchedPair = pairArray.find(p => p.startsWith(`${letter}:`));
                        const selectedVal = matchedPair ? matchedPair.split(':')[1] : '';

                        const handleSelect = (val: '1' | '0') => {
                          const otherPairs = pairArray.filter(p => !p.startsWith(`${letter}:`)).filter(Boolean);
                          const updatedVal = [...otherPairs, `${letter}:${val}`].sort().join(',');
                          saveAnswer(currentQuestion.id, updatedVal);
                        };

                        return (
                          <tr key={letter}>
                            <td style={{ fontSize: '13px', padding: '10px 12px' }}><LatexRenderer content={statementText} /></td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="radio"
                                name={`matrix_${currentQuestion.id}_${letter}`}
                                checked={selectedVal === '1'}
                                onChange={() => handleSelect('1')}
                                style={{ transform: 'scale(1.2)' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="radio"
                                name={`matrix_${currentQuestion.id}_${letter}`}
                                checked={selectedVal === '0'}
                                onChange={() => handleSelect('0')}
                                style={{ transform: 'scale(1.2)' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.optionsList}>
                  {(['A', 'B', 'C', 'D', ...(currentQuestion.pilihan_e ? ['E'] : [])] as string[]).map(letter => {
                    const key = `pilihan_${letter.toLowerCase()}` as keyof Question;
                    const text = currentQuestion[key] as string;
                    if (!text) return null;
                    
                    const isMulti = currentQuestion.kunci_jawaban.length > 1;
                    const selected = isMulti
                      ? (answers[currentQuestion.id] ? answers[currentQuestion.id].split(',').includes(letter) : false)
                      : answers[currentQuestion.id] === letter;

                    return (
                      <label
                        key={letter}
                        className={`${styles.optionItem} ${selected ? styles.optionSelected : ''}`}
                        onClick={() => saveAnswer(currentQuestion.id, letter)}
                      >
                        {isMulti ? (
                          <span className={styles.optionCheckbox} style={{ borderColor: selected ? '#0d6efd' : '#aaa' }}>
                            {selected && <span className={styles.optionCheckboxInner} />}
                          </span>
                        ) : (
                          <span className={styles.optionRadio}>
                            <span className={styles.optionRadioInner} style={{ background: selected ? '#0d6efd' : 'transparent' }} />
                          </span>
                        )}
                        <span className={styles.optionLetter}>{letter}.</span>
                        <LatexRenderer content={text} className={styles.optionText} />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className={styles.questionFooter}>
                <div className={styles.footerLeft}>
                  <button
                    className={`${styles.btnRagu} ${flags[currentQuestion.id] ? styles.btnRaguActive : ''}`}
                    onClick={() => toggleFlag(currentQuestion.id)}
                  >
                    {flags[currentQuestion.id] ? 'Hapus Ragu-ragu' : 'Ragu-ragu'}
                  </button>
                  <div className={styles.zoomControls}>
                    <button 
                      className={styles.btnZoom} 
                      onClick={() => setZoomFactor(prev => Math.max(80, prev - 10))}
                      title="Perkecil teks"
                    >
                      A-
                    </button>
                    <button 
                      className={styles.btnZoom} 
                      onClick={() => setZoomFactor(prev => Math.min(150, prev + 10))}
                      title="Perbesar teks"
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div className={styles.footerRight}>
                  <button
                    className={styles.btnNav}
                    onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIdx === 0}
                  >
                    Sebelumnya
                  </button>
                  {currentQuestionIdx < subtestQuestions.length - 1 ? (
                    <button className={`${styles.btnNav} ${styles.btnNavNext}`} onClick={() => setCurrentQuestionIdx(prev => prev + 1)}>
                      Berikutnya
                    </button>
                  ) : currentSubtestIdx < subtests.length - 1 ? (
                    <button className={`${styles.btnNav} ${styles.btnNavNext}`} onClick={() => goToSubtest(currentSubtestIdx + 1)}>
                      Subtes Berikutnya
                    </button>
                  ) : (
                    <button className={styles.btnFinish} onClick={() => setShowSubmitConfirm(true)}>
                      Selesai
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.noQuestion}>
              <p>Tidak ada soal untuk subtes ini.</p>
              {currentSubtestIdx < subtests.length - 1 && (
                <button className={styles.btnMulai} onClick={() => goToSubtest(currentSubtestIdx + 1)}>
                  Lanjut ke Subtes Berikutnya
                </button>
              )}
            </div>
          )}

          <div className={styles.examFooter}>
            <button className={styles.btnSelesai} onClick={() => setShowSubmitConfirm(true)}>
              Selesai Ujian
            </button>
            <span className={styles.violationCount}>Pelanggaran: {violations}</span>
          </div>
        </main>
      </div>
    </div>
  );
}
