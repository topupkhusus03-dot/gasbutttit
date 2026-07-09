'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { User } from '@/types';
import adminStyles from '../admin.module.css';

export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'user')
      .order('created_at', { ascending: false });
    setUsers(data ?? []);
  }, [supabase]);

  const handleResetAccount = async (userId: string, userName: string) => {
    if (!window.confirm(`PERINGATAN: Anda yakin ingin meriset akun ${userName} dari awal?\n\nSemua data pilihan prodi, riwayat tryout, dan hasil ujian mereka akan dihapus permanen.`)) return;
    
    try {
      const { error } = await supabase.rpc('reset_user_account', { target_user_id: userId });
      if (error) {
        alert('Gagal mereset akun: ' + error.message);
      } else {
        alert(`Berhasil mereset akun ${userName}!`);
        // We don't necessarily need to reload users if we aren't displaying their stats, but good to refresh.
      }
    } catch (err: any) {
      alert('Gagal mereset akun: ' + err.message);
    }
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
      await loadUsers();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadUsers]);

  const filtered = users.filter(u =>
    u.nama?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.nomor_peserta_utbk?.includes(search) ||
    u.nisn?.includes(search)
  );

  if (loading) return <div className="page-loader"><div className="spinner spinner-lg" /></div>;

  return (
    <div className={adminStyles.layout}>
      {isSidebarOpen && (
        <div 
          className={adminStyles.sidebarOverlay} 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`${adminStyles.sidebar} ${isSidebarOpen ? adminStyles.sidebarOpen : ''}`}>
        <div className={adminStyles.sidebarLogo}>
          <img src="/logo.png" alt="Logo" className={adminStyles.logoImg} />
          <span>Admin Panel</span>
        </div>
        <nav className={adminStyles.sideNav}>
          <Link href="/admin" className={adminStyles.navItem}>Dashboard</Link>
          <Link href="/admin/questions" className={adminStyles.navItem}>Manajemen Soal</Link>
          <Link href="/admin/users" className={`${adminStyles.navItem} ${adminStyles.navActive}`}>Manajemen User</Link>
          <Link href="/admin/programs" className={adminStyles.navItem}>Data Prodi</Link>
          <Link href="/admin/results" className={adminStyles.navItem}>Hasil Peserta</Link>
          <Link href="/admin/violations" className={adminStyles.navItem}>Log Pelanggaran</Link>
        </nav>
      </aside>

      <main className={adminStyles.main}>
        <header className={adminStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className={adminStyles.hamburgerBtn}
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <h1 className={adminStyles.headerTitle}>Manajemen User ({filtered.length})</h1>
          </div>
        </header>

        <div className={adminStyles.content}>
          <input
            type="search"
            className="form-input"
            style={{ maxWidth: 400 }}
            placeholder="Cari nama, email, NISN, atau nomor peserta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>NISN</th>
                  <th>No. Peserta UTBK</th>
                  <th>Asal Sekolah</th>
                  <th>Daftar</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Tidak ada data</td></tr>
                )}
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {u.foto_url
                          ? <img src={u.foto_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{u.nama?.[0]?.toUpperCase()}</div>
                        }
                        <span style={{ fontSize: 14 }}>{u.nama}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ fontSize: 13 }}>{u.nisn || '-'}</td>
                    <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{u.nomor_peserta_utbk || '-'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.asal_sekolah || '-'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ borderColor: 'var(--red-400)', color: 'var(--red-500)', fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => handleResetAccount(u.id, u.nama)}
                      >
                        Reset Akun
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
