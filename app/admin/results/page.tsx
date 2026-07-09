'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import adminStyles from '../admin.module.css';

interface ResultRow {
  id: string;
  session_id: string;
  user_id: string;
  nama: string;
  nomor_peserta: string;
  skor_penalaran_umum: number;
  skor_ppu: number;
  skor_pbm: number;
  skor_pk: number;
  skor_literasi_id_saintek: number;
  skor_literasi_id_soshum: number;
  skor_literasi_en: number;
  skor_penalaran_matematika: number;
  tanggal_selesai: string;
}

export default function AdminResultsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadResults = useCallback(async () => {
    const { data } = await supabase
      .from('exam_results')
      .select(`
        *,
        profiles:user_id(nama, nomor_peserta_utbk)
      `)
      .order('tanggal_selesai', { ascending: false });

    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      nama: (r.profiles as { nama: string })?.nama ?? '-',
      nomor_peserta: (r.profiles as { nomor_peserta_utbk: string })?.nomor_peserta_utbk ?? '-',
    })) as ResultRow[];

    setResults(rows);
  }, [supabase]);

  const handleDeleteResult = async (sessionId: string, userName: string) => {
    if (!window.confirm(`PERINGATAN: Anda yakin ingin menghapus hasil ujian milik ${userName}?\n\nSemua jawaban dan skor akan dihapus permanen.`)) return;
    
    try {
      const { error } = await supabase.rpc('delete_exam_session', { target_session_id: sessionId });
      if (error) {
        alert('Gagal menghapus hasil ujian: ' + error.message);
      } else {
        alert(`Berhasil menghapus hasil ujian ${userName}!`);
        await loadResults();
      }
    } catch (err: any) {
      alert('Gagal menghapus hasil ujian: ' + err.message);
    }
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
      await loadResults();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadResults]);

  function exportExcel() {
    const rows = results.map(r => ({
      'Nama': r.nama,
      'No. Peserta': r.nomor_peserta,
      'Penalaran Umum': r.skor_penalaran_umum?.toFixed(2),
      'PPU': r.skor_ppu?.toFixed(2),
      'PBM': r.skor_pbm?.toFixed(2),
      'PK': r.skor_pk?.toFixed(2),
      'Literasi ID Saintek': r.skor_literasi_id_saintek?.toFixed(2),
      'Literasi ID Soshum': r.skor_literasi_id_soshum?.toFixed(2),
      'Literasi Inggris': r.skor_literasi_en?.toFixed(2),
      'Penalaran Matematika': r.skor_penalaran_matematika?.toFixed(2),
      'Tanggal': new Date(r.tanggal_selesai).toLocaleDateString('id-ID'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil');
    XLSX.writeFile(wb, `hasil-tryout-snbt-${Date.now()}.xlsx`);
  }

  const filtered = results.filter(r =>
    r.nama?.toLowerCase().includes(search.toLowerCase()) ||
    r.nomor_peserta?.includes(search)
  );

  function formatSkor(n: number) {
    return n ? n.toFixed(2).replace('.', ',') : '-';
  }

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
          <Link href="/admin/users" className={adminStyles.navItem}>Manajemen User</Link>
          <Link href="/admin/programs" className={adminStyles.navItem}>Data Prodi</Link>
          <Link href="/admin/results" className={`${adminStyles.navItem} ${adminStyles.navActive}`}>Hasil Peserta</Link>
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
            <h1 className={adminStyles.headerTitle}>Hasil Peserta ({filtered.length})</h1>
          </div>
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={async () => {
                  if(!confirm('Yakin ingin kalkulasi ulang IRT Nasional? Seluruh skor saat ini akan ditimpa!')) return;
                  try {
                    const res = await fetch('/api/admin/recalculate-irt', { method: 'POST' });
                    const data = await res.json();
                    if(data.success) {
                      alert(`Berhasil kalkulasi ulang! ${data.updatedResults} peserta diperbarui.`);
                      loadResults();
                    } else {
                      alert('Gagal: ' + data.error);
                    }
                  } catch(e) {
                    alert('Terjadi kesalahan: ' + e);
                  }
                }}
              >
                Kalkulasi Ulang IRT Nasional
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportExcel}>
                Export Excel
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>No. Peserta</th>
                  <th>PU</th>
                  <th>PPU</th>
                  <th>PBM</th>
                  <th>PK</th>
                  <th>LBI-ST</th>
                  <th>LBI-SH</th>
                  <th>LIE</th>
                  <th>PM</th>
                  <th>Tanggal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Belum ada hasil</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, fontSize: 14 }}>{r.nama}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.nomor_peserta}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_penalaran_umum)}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_ppu)}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_pbm)}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_pk)}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_literasi_id_saintek)}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_literasi_id_soshum)}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_literasi_en)}</td>
                    <td style={{ fontSize: 13 }}>{formatSkor(r.skor_penalaran_matematika)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(r.tanggal_selesai).toLocaleDateString('id-ID')}
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-danger"
                        style={{ padding: '4px 8px', fontSize: 12, backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => handleDeleteResult(r.session_id, r.nama)}
                      >
                        Hapus
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
