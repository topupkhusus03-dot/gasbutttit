'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { User, ExamSession, ExamResult, ProgramSelection, StudyProgram, University } from '@/types';
import styles from './dashboard.module.css';

interface ProgramWithUniversity extends StudyProgram {
  university: University;
}

interface SelectionWithPrograms {
  pilihan_1: ProgramWithUniversity | null;
  pilihan_2: ProgramWithUniversity | null;
  pilihan_3: ProgramWithUniversity | null;
  pilihan_4: ProgramWithUniversity | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [selection, setSelection] = useState<SelectionWithPrograms | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnnounced, setIsAnnounced] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/auth/login'); return; }

    const [profileRes, sessionRes, selectionRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', authUser.id).single(),
      supabase.from('exam_sessions').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('program_selections').select(`
        *,
        pilihan_1:study_programs!pilihan_1(*, university:universities(*)),
        pilihan_2:study_programs!pilihan_2(*, university:universities(*)),
        pilihan_3:study_programs!pilihan_3(*, university:universities(*)),
        pilihan_4:study_programs!pilihan_4(*, university:universities(*))
      `).eq('user_id', authUser.id).maybeSingle(),
    ]);

    if (profileRes.error) {
      console.error('Profile Fetch Error:', profileRes.error);
      alert('Error fetching profile: ' + JSON.stringify(profileRes.error));
    }

    let currentUserData = profileRes.data;

    // Auto-generate nomor_peserta_utbk for existing users who don't have one
    if (currentUserData && !currentUserData.nomor_peserta_utbk) {
      const year = '26';
      const loc = String(Math.floor(Math.random() * 9000) + 1000);
      const seq = String(Math.floor(Math.random() * 900000) + 100000);
      const newNomor = `${year}-${loc}-${seq}`;
      
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ nomor_peserta_utbk: newNomor })
        .eq('id', authUser.id);
        
      if (!updateErr) {
        currentUserData = { ...currentUserData, nomor_peserta_utbk: newNomor };
      }
    }

    setUser(currentUserData);
    setSession(sessionRes.data);
    setSelection(selectionRes.data as SelectionWithPrograms | null);

    if (sessionRes.data?.status === 'completed') {

      const { data: resultData } = await supabase
        .from('exam_results')
        .select('*')
        .eq('session_id', sessionRes.data.id)
        .maybeSingle();
      setResult(resultData);
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { 
    loadData(); 
    
    let interval: NodeJS.Timeout;
    
    const fetchAnnouncement = async () => {
      const { data } = await supabase.from('global_settings').select('value').eq('key', 'snbt_announcement_time').maybeSingle();
      if (data && data.value) {
        const targetTime = new Date(data.value).getTime();
        
        const check = () => {
          setIsAnnounced(Date.now() >= targetTime);
        };
        check();
        interval = setInterval(check, 1000);
      }
    };
    
    fetchAnnouncement();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loadData, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  async function startExam() {
    if (!user) return;
    if (!session || session.status !== 'pending') {
      alert('Anda harus menyimpan permanen pilihan prodi terlebih dahulu.');
      router.push('/dashboard/programs');
      return;
    }

    const { data, error } = await supabase
      .from('exam_sessions')
      .update({ status: 'ongoing', waktu_mulai: new Date().toISOString() })
      .eq('id', session.id)
      .select()
      .single();

    if (!error && data) {
      router.push('/exam');
    }
  }



  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner spinner-lg" />
        <span>Memuat data...</span>
      </div>
    );
  }

  const hasSelection = !!selection && (!!selection.pilihan_1 || !!selection.pilihan_2 || !!selection.pilihan_3 || !!selection.pilihan_4);
  const statusLabel = !hasSelection ? 'Belum Simpan Prodi' : session?.status === 'pending' ? 'Belum Mulai' : session?.status === 'ongoing' ? 'Sedang Berlangsung' : 'Selesai';
  const statusBadge = !hasSelection || session?.status === 'pending' ? 'badge-slate' : session?.status === 'ongoing' ? 'badge-yellow' : 'badge-green';

  return (
    <div className={styles.layout}>
      {isSidebarOpen && (
        <div 
          className={styles.sidebarOverlay} 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <img src="/logo.png" alt="Logo" className={styles.sideLogoImg} />
          <span>TryoutSNBT</span>
        </div>
        <nav className={styles.sideNav}>
          <Link href="/dashboard" className={`${styles.navItem} ${styles.navActive}`}>Dashboard</Link>
          <Link href="/dashboard/programs" className={styles.navItem}>Pilihan Prodi</Link>
          <Link href="/pengumuman" className={styles.navItem}>Pengumuman SNBT</Link>
          {isAnnounced && session?.status === 'completed' && <Link href="/certificate" className={styles.navItem}>Sertifikat</Link>}
          {user?.role === 'admin' && (
            <Link href="/admin" className={styles.navItem} style={{ color: 'var(--yellow-500)' }}>
              Admin Panel
            </Link>
          )}
        </nav>
        <button onClick={handleLogout} className={styles.logoutBtn}>Keluar</button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className={styles.hamburgerBtn}
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <div>
              <h1 className={styles.headerTitle}>Dashboard</h1>
              <p className={styles.headerSub}>Selamat datang, {user?.nama}</p>
            </div>
          </div>
          <div className={styles.headerProfile}>
            {user?.foto_url
              ? <img src={user.foto_url} alt="Foto" className={styles.profileAvatar} />
              : <div className={styles.profileAvatarPlaceholder}>{user?.nama?.[0]?.toUpperCase()}</div>
            }
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.statsRow}>
            <div className="stat-card">
              <div className={styles.statIcon} style={{ color: 'var(--blue-400)' }}>ID</div>
              <div className="stat-value" style={{ fontSize: '16px' }}>{user?.nomor_peserta_utbk || '-'}</div>
              <div className="stat-label">Nomor Peserta UTBK</div>
            </div>
            <div className="stat-card">
              <div className="stat-value"><span className={`badge ${statusBadge}`}>{statusLabel}</span></div>
              <div className="stat-label" style={{ marginTop: 8 }}>Status Tryout</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '20px' }}>{user?.asal_sekolah || '-'}</div>
              <div className="stat-label">Asal Sekolah</div>
            </div>
          </div>

          {(!session || session.status === 'pending' || (!hasSelection && session.status === 'ongoing')) && (
            <div className={styles.examCard}>
              <h2 className={styles.examTitle}>Mulai Tryout UTBK-SNBT</h2>
              <p className={styles.examDesc}>
                Ujian terdiri dari 7 subtes dengan total waktu 195 menit.
                Pastikan Anda berada di tempat yang tenang dan memiliki koneksi internet stabil.
              </p>
              <div className={styles.examMeta}>
                <div className={styles.examMetaItem}><strong>7</strong> Subtes</div>
                <div className={styles.examMetaDivider} />
                <div className={styles.examMetaItem}><strong>160</strong> Soal</div>
                <div className={styles.examMetaDivider} />
                <div className={styles.examMetaItem}><strong>195</strong> Menit</div>
              </div>
              <div className={styles.examWarning}>
                Setelah tryout dimulai, tidak dapat diulang. Pastikan sudah siap.
              </div>
              {!hasSelection ? (
                <Link href="/dashboard/programs" className="btn btn-primary btn-lg" style={{ opacity: 0.8 }}>
                  Pilih & Simpan Prodi Dulu
                </Link>
              ) : (
                <button onClick={startExam} className="btn btn-primary btn-lg">Mulai Tryout</button>
              )}
            </div>
          )}

          {(session?.status === 'ongoing' && hasSelection) && (
            <div className={styles.examCard}>
              <h2 className={styles.examTitle}>Tryout Sedang Berlangsung</h2>
              <p className={styles.examDesc}>Anda memiliki sesi tryout yang sedang aktif.</p>
              <Link href="/exam" className="btn btn-primary btn-lg">Lanjutkan Tryout</Link>
            </div>
          )}

          {session?.status === 'completed' && !isAnnounced && (
            <div className={styles.examCard} style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-200)' }}>
              <h2 className={styles.examTitle}>Tryout Selesai</h2>
              <p className={styles.examDesc}>
                Terima kasih telah mengikuti Tryout SNBT 2027. Hasil Tryout dan Sertifikat Anda sedang diproses.
              </p>
              <div className={styles.examWarning} style={{ color: 'var(--blue-600)', background: 'var(--blue-100)' }}>
                Hasil dan Sertifikat baru dapat diakses setelah waktu <b>Pengumuman SNBT</b> tiba.
              </div>
            </div>
          )}

          {session?.status === 'completed' && isAnnounced && (
            <div className={styles.examCard} style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.08))', borderColor: 'var(--green-400)', textAlign: 'center' }}>
              <h2 className={styles.examTitle} style={{ color: 'var(--green-400)' }}>🎉 Pengumuman Telah Dibuka!</h2>
              <p className={styles.examDesc}>
                Hasil kelulusan Tryout SNBT 2027 sudah dapat diakses. Untuk melihat detail nilai skor UTBK Anda, silakan unduh Sertifikat.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/pengumuman" className="btn btn-primary btn-lg">Cek Kelulusan</Link>
                <Link href="/certificate" className="btn btn-secondary btn-lg">Unduh Sertifikat (Nilai)</Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
