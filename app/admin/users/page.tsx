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
  const [actionLoading, setActionLoading] = useState(false);
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
    
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('reset_user_account', { target_user_id: userId });
      if (error) {
        alert('Gagal mereset akun: ' + error.message);
      } else {
        alert(`Berhasil mereset akun ${userName}!`);
      }
    } catch (err: any) {
      alert('Gagal mereset akun: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` };
      }
    } catch (e) {}
    return {};
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`PERINGATAN: Anda yakin ingin MENGHAPUS user ${userName}?\n\nSemua data profil, pilihan prodi, dan hasil tryout user ini akan dihapus permanen.`)) return;

    setActionLoading(true);
    let isSuccess = false;
    let errorMessage = '';

    try {
      // 1. Try Supabase RPC first if available
      const rpcRes = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
      if (!rpcRes.error) {
        isSuccess = true;
      } else {
        // 2. Call server API route with Bearer auth token
        const headers = await getAuthHeader();
        const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE', headers });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          isSuccess = true;
        } else {
          // 3. Fallback to client-side direct delete
          const { error: directErr } = await supabase.from('profiles').delete().eq('id', userId);
          if (!directErr) {
            isSuccess = true;
          } else {
            errorMessage = data.error || directErr.message || rpcRes.error.message;
          }
        }
      }

      await loadUsers();

      if (isSuccess) {
        alert(`Berhasil menghapus user ${userName}!`);
      } else {
        alert(`Gagal menghapus user: ${errorMessage || 'Periksa izin RLS di Supabase.'}`);
      }
    } catch (err: any) {
      alert('Gagal menghapus user: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAllUsers = async () => {
    if (users.length === 0) {
      alert('Tidak ada user untuk dihapus.');
      return;
    }

    if (!window.confirm(`PERINGATAN KRUSIAL: Anda yakin ingin MENGHAPUS SEMUA USER (${users.length} akun peserta)?\n\nSemua data profil, riwayat tryout, dan hasil ujian mereka akan dihapus permanen.\nTindakan ini TIDAK DAPAT DIBATALKAN!`)) return;

    setActionLoading(true);
    let isSuccess = false;
    let errorMessage = '';

    try {
      // 1. Try Supabase RPC first if available
      const rpcRes = await supabase.rpc('delete_all_users_by_admin');
      if (!rpcRes.error) {
        isSuccess = true;
      } else {
        // 2. Call server API route with Bearer auth token
        const headers = await getAuthHeader();
        const res = await fetch('/api/admin/users?all=true', { method: 'DELETE', headers });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          isSuccess = true;
        } else {
          // 3. Fallback to client-side direct delete
          const { error: directErr } = await supabase.from('profiles').delete().eq('role', 'user');
          if (!directErr) {
            isSuccess = true;
          } else {
            errorMessage = data.error || directErr.message || rpcRes.error.message;
          }
        }
      }

      // Re-fetch users from database to confirm actual deletion
      const { data: remainingUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

      const currentCount = remainingUsers ? remainingUsers.length : 0;
      setUsers(remainingUsers ?? []);

      if (currentCount === 0) {
        alert('Semua user peserta berhasil dihapus.');
      } else {
        alert(`Gagal: Masih terdapat ${currentCount} user di database. Pastikan script SQL delete_all_users_by_admin sudah dijalankan di Supabase SQL Editor atau hapus langsung via SQL Editor.`);
      }
    } catch (err: any) {
      alert('Gagal menghapus semua user: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!profile || profile.role !== 'admin') { router.push('/dashboard'); return; }
      await loadUsers();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadUsers]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

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
        <button onClick={handleLogout} className={adminStyles.logoutBtn}>Keluar</button>
      </aside>

      <main className={adminStyles.main}>
        <header className={adminStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className={adminStyles.hamburgerBtn} aria-label="Buka menu navigasi"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <h1 className={adminStyles.headerTitle}>Manajemen User ({filtered.length})</h1>
          </div>
        </header>

        <div className={adminStyles.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="search"
              className="form-input"
              style={{ maxWidth: 400 }}
              placeholder="Cari nama, email, NISN, atau nomor peserta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {users.length > 0 && (
              <button 
                className="btn btn-danger btn-sm"
                onClick={handleDeleteAllUsers}
                disabled={actionLoading}
              >
                {actionLoading ? 'Memproses...' : 'Hapus Semua User'}
              </button>
            )}
          </div>

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
                          ? <img src={u.foto_url} alt={u.nama} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
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
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ borderColor: 'var(--amber-400, #f59e0b)', color: 'var(--amber-500, #d97706)', fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => handleResetAccount(u.id, u.nama)}
                          disabled={actionLoading}
                        >
                          Reset Akun
                        </button>
                        <button 
                          className="btn btn-danger btn-sm" 
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => handleDeleteUser(u.id, u.nama)}
                          disabled={actionLoading}
                        >
                          Hapus
                        </button>
                      </div>
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
