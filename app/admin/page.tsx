'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './admin.module.css';

interface Stats {
  totalUsers: number;
  totalQuestions: number;
  totalSessions: number;
  completedSessions: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalQuestions: 0, totalSessions: 0, completedSessions: 0 });
  const [loading, setLoading] = useState(true);
  const [announcementTime, setAnnouncementTime] = useState('');
  const [savingTime, setSavingTime] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/dashboard'); return; }

      const [usersRes, questionsRes, sessionsRes, completedRes, timeRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'user'),
        supabase.from('questions').select('id', { count: 'exact' }),
        supabase.from('exam_sessions').select('id', { count: 'exact' }),
        supabase.from('exam_sessions').select('id', { count: 'exact' }).eq('status', 'completed'),
        supabase.from('global_settings').select('value').eq('key', 'snbt_announcement_time').maybeSingle()
      ]);

      if (timeRes.data) {
        const date = new Date(timeRes.data.value);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        setAnnouncementTime(date.toISOString().slice(0, 16));
      }

      setStats({
        totalUsers: usersRes.count ?? 0,
        totalQuestions: questionsRes.count ?? 0,
        totalSessions: sessionsRes.count ?? 0,
        completedSessions: completedRes.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  async function handleSaveTime() {
    setSavingTime(true);
    const isoString = new Date(announcementTime).toISOString();
    await supabase.from('global_settings').upsert({ key: 'snbt_announcement_time', value: isoString });
    setSavingTime(false);
    alert('Waktu pengumuman berhasil disimpan!');
  }

  const menuItems = [
    { label: 'Manajemen Soal', href: '/admin/questions', desc: 'Input, edit, dan import soal per subtes' },
    { label: 'Manajemen User', href: '/admin/users', desc: 'Lihat dan kelola akun peserta' },
    { label: 'Data Prodi', href: '/admin/programs', desc: 'Import dan kelola program studi PTN' },
    { label: 'Hasil Peserta', href: '/admin/results', desc: 'Lihat nilai IRT semua peserta' },
  ];

  if (loading) {
    return <div className="page-loader"><div className="spinner spinner-lg" /></div>;
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
          <span>Admin Panel</span>
        </div>
        <nav className={styles.sideNav}>
          <Link href="/admin" className={`${styles.navItem} ${styles.navActive}`}>Dashboard</Link>
          <Link href="/admin/questions" className={styles.navItem}>Manajemen Soal</Link>
          <Link href="/admin/users" className={styles.navItem}>Manajemen User</Link>
          <Link href="/admin/programs" className={styles.navItem}>Data Prodi</Link>
          <Link href="/admin/results" className={styles.navItem}>Hasil Peserta</Link>
          <Link href="/admin/violations" className={styles.navItem}>Log Pelanggaran</Link>
        </nav>
        <button onClick={handleLogout} className={styles.logoutBtn}>Keluar</button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Dashboard Admin</h1>
        </header>

        <div className={styles.content}>
          <div className={styles.statsGrid}>
            <div className="stat-card">
              <div className="stat-value">{stats.totalUsers}</div>
              <div className="stat-label">Total Peserta</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalQuestions}</div>
              <div className="stat-label">Total Soal</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalSessions}</div>
              <div className="stat-label">Sesi Ujian</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.completedSessions}</div>
              <div className="stat-label">Ujian Selesai</div>
            </div>
          </div>

          <div className={styles.settingsSection} style={{ background: 'var(--surface-color, #1e293b)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#f8fafc' }}>Pengaturan Sistem</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
              <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: '500' }}>Waktu Pengumuman SNBT</label>
              <input 
                type="datetime-local" 
                value={announcementTime} 
                onChange={e => setAnnouncementTime(e.target.value)}
                style={{ 
                  padding: '10px', 
                  borderRadius: '6px', 
                  border: '1px solid rgba(255,255,255,0.2)', 
                  width: '100%',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'white',
                  colorScheme: 'dark'
                }}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleSaveTime} 
                disabled={savingTime}
                style={{ marginTop: '8px' }}
              >
                {savingTime ? 'Menyimpan...' : 'Simpan Jadwal'}
              </button>
            </div>
          </div>

          <div className={styles.menuGrid}>
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={styles.menuCard}>
                <h3 className={styles.menuTitle}>{item.label}</h3>
                <p className={styles.menuDesc}>{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
