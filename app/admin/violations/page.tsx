'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import adminStyles from '../admin.module.css';

interface ViolationRow {
  id: string;
  session_id: string;
  jenis_pelanggaran: string;
  created_at: string;
  nama: string;
  nomor_peserta: string;
  tanggal_tes: string;
}

export default function AdminViolationsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadViolations = useCallback(async () => {
    // Fetch violations with user details via exam_sessions
    const { data, error } = await supabase
      .from('exam_violations')
      .select(`
        id,
        session_id,
        jenis_pelanggaran,
        created_at,
        exam_sessions!inner (
          tanggal_tes,
          profiles!inner (
            nama,
            nomor_peserta_utbk
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      session_id: r.session_id,
      jenis_pelanggaran: r.jenis_pelanggaran,
      created_at: r.created_at,
      nama: r.exam_sessions?.profiles?.nama ?? '-',
      nomor_peserta: r.exam_sessions?.profiles?.nomor_peserta_utbk ?? '-',
      tanggal_tes: r.exam_sessions?.tanggal_tes ?? '-'
    })) as ViolationRow[];

    setViolations(rows);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
      await loadViolations();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadViolations]);

  function exportExcel() {
    const rows = violations.map(r => ({
      'Waktu Kejadian': new Date(r.created_at).toLocaleString('id-ID'),
      'Nama Peserta': r.nama,
      'No. Peserta': r.nomor_peserta,
      'Tanggal Ujian': r.tanggal_tes,
      'Jenis Pelanggaran': r.jenis_pelanggaran
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Pelanggaran');
    XLSX.writeFile(wb, `log-pelanggaran-${Date.now()}.xlsx`);
  }

  const filtered = violations.filter(r =>
    r.nama?.toLowerCase().includes(search.toLowerCase()) ||
    r.nomor_peserta?.includes(search)
  );

  if (loading) return <div className="page-loader"><div className="spinner spinner-lg" /></div>;

  return (
    <div className={adminStyles.layout}>
      <aside className={adminStyles.sidebar}>
        <div className={adminStyles.sidebarLogo}>
          <img src="/logo.png" alt="Logo" className={adminStyles.logoImg} />
          <span>Admin Panel</span>
        </div>
        <nav className={adminStyles.sideNav}>
          <Link href="/admin" className={adminStyles.navItem}>Dashboard</Link>
          <Link href="/admin/questions" className={adminStyles.navItem}>Manajemen Soal</Link>
          <Link href="/admin/users" className={adminStyles.navItem}>Manajemen User</Link>
          <Link href="/admin/programs" className={adminStyles.navItem}>Data Prodi</Link>
          <Link href="/admin/results" className={adminStyles.navItem}>Hasil Peserta</Link>
          <Link href="/admin/violations" className={`${adminStyles.navItem} ${adminStyles.navActive}`}>Log Pelanggaran</Link>
        </nav>
      </aside>

      <main className={adminStyles.main}>
        <header className={adminStyles.header}>
          <h1 className={adminStyles.headerTitle}>Log Pelanggaran Ujian</h1>
        </header>

        <div className={adminStyles.content}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="search"
              className="form-input"
              style={{ maxWidth: 360 }}
              placeholder="Cari nama atau nomor peserta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={exportExcel}>
              Export Excel
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Waktu Kejadian</th>
                  <th>Peserta</th>
                  <th>Jenis Pelanggaran</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div><strong>{new Date(r.created_at).toLocaleDateString('id-ID')}</strong></div>
                      <div className="text-muted" style={{ fontSize: '13px' }}>{new Date(r.created_at).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td>
                      <div><strong>{r.nama}</strong></div>
                      <div className="text-muted" style={{ fontSize: '13px' }}>{r.nomor_peserta}</div>
                    </td>
                    <td>
                      <span className="badge badge-red">{r.jenis_pelanggaran}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted" style={{ padding: 'var(--space-6) 0' }}>
                      Tidak ada data pelanggaran
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
