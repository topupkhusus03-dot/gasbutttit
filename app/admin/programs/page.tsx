'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import adminStyles from '../admin.module.css';

interface UniversityRow {
  id: string;
  nama_universitas: string;
  kode_universitas: string;
  jenis: string;
  provinsi: string;
}

interface ProgramRow {
  id: string;
  university_id: string;
  nama_prodi: string;
  kode_prodi: string;
  jenis: string;
  daya_tampung: number;
  nama_universitas?: string;
}

export default function AdminProgramsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'universities' | 'programs'>('universities');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const loadData = useCallback(async () => {
    const fetchAll = async (table: string, select: string, orderColumn: string) => {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .order(orderColumn)
          .order('id') // Secondary sort to ensure stable pagination
          .range(from, from + step - 1);
          
        if (error || !data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < step) break;
        from += step;
      }
      
      // Deduplicate just in case
      const seen = new Set();
      return allData.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    const univs = await fetchAll('universities', '*', 'nama_universitas');
    const progsRaw = await fetchAll('study_programs', '*, university:universities(nama_universitas)', 'nama_prodi');

    setUniversities(univs);
    const progs = progsRaw.map((p: any) => ({
      ...p,
      nama_universitas: p.university?.nama_universitas,
    })) as ProgramRow[];
    setPrograms(progs);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
      
      // Auto import script
      if (!localStorage.getItem('auto_imported_universities_prodi_v5')) {
        setImporting(true);
        setImportStatus('Memasukkan data UI & ITB otomatis...');
        try {
          const res = await fetch('/auto-import-data.json');
          if (res.ok) {
            const data = await res.json();
            for (const row of data.universities) {
              await supabase.from('universities').upsert(row, { onConflict: 'kode_universitas' });
            }
            const univs = (await supabase.from('universities').select('id, kode_universitas')).data ?? [];
            for (const row of data.programs) {
              const univ = univs.find(u => u.kode_universitas === row.kode_universitas);
              if (univ) {
                const existing = await supabase.from('study_programs').select('id').eq('university_id', univ.id).eq('kode_prodi', row.kode_prodi).maybeSingle();
                const payload = {
                  university_id: univ.id,
                  nama_prodi: row.nama_prodi,
                  kode_prodi: row.kode_prodi,
                  jenis: row.jenis,
                  daya_tampung: row.daya_tampung,
                  rata_rata_nilai_masuk: 650 + Math.random() * 50
                };
                if (existing.data) {
                  await supabase.from('study_programs').update(payload).eq('id', existing.data.id);
                } else {
                  await supabase.from('study_programs').insert(payload);
                }
              }
            }
            localStorage.setItem('auto_imported_universities_prodi_v5', 'true');
            setImportStatus('Data universitas & prodi berhasil dimasukkan otomatis!');
          }
        } catch (e) {
          console.error('Auto import failed', e);
        }
        setImporting(false);
      }

      await loadData();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadData]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus('Membaca file...');

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    let univSuccess = 0, univFail = 0, progSuccess = 0, progFail = 0;

    if (workbook.SheetNames.includes('Universitas')) {
      const sheet = workbook.Sheets['Universitas'];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      for (const row of rows) {
        const { error } = await supabase.from('universities').upsert({
          nama_universitas: String(row['nama_universitas'] || row['Nama Universitas'] || ''),
          kode_universitas: String(row['kode_universitas'] || row['Kode'] || ''),
          jenis: String(row['jenis'] || row['Jenis'] || 'PTN Akademik'),
          provinsi: String(row['provinsi'] || row['Provinsi'] || ''),
        }, { onConflict: 'kode_universitas' });
        error ? univFail++ : univSuccess++;
      }
    }

    if (workbook.SheetNames.includes('Prodi')) {
      const sheet = workbook.Sheets['Prodi'];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const univs = (await supabase.from('universities').select('id, kode_universitas')).data ?? [];

      for (const row of rows) {
        const kodeUniv = String(row['kode_universitas'] || row['Kode Universitas'] || '');
        const univ = univs.find(u => u.kode_universitas === kodeUniv);
        if (!univ) { progFail++; continue; }

        const payload = {
          university_id: univ.id,
          nama_prodi: String(row['nama_prodi'] || row['Nama Prodi'] || ''),
          kode_prodi: String(row['kode_prodi'] || row['Kode Prodi'] || ''),
          jenis: String(row['jenis'] || row['Jenis'] || 'Sarjana'),
          daya_tampung: parseInt(String(row['daya_tampung'] || row['Daya Tampung'] || '0')),
          rata_rata_nilai_masuk: parseFloat(String(row['rata_nilai'] || '0')) || null,
        };

        const existing = await supabase.from('study_programs').select('id').eq('university_id', univ.id).eq('kode_prodi', payload.kode_prodi).maybeSingle();
        
        let error;
        if (existing.data) {
          const res = await supabase.from('study_programs').update(payload).eq('id', existing.data.id);
          error = res.error;
        } else {
          const res = await supabase.from('study_programs').insert(payload);
          error = res.error;
        }

        error ? progFail++ : progSuccess++;
      }
    }

    setImportStatus(`Universitas: ${univSuccess} berhasil, ${univFail} gagal. Prodi: ${progSuccess} berhasil, ${progFail} gagal.`);
    await loadData();
    setImporting(false);
    e.target.value = '';
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const univHeaders = ['nama_universitas', 'kode_universitas', 'jenis', 'provinsi'];
    const univExample = ['Universitas Indonesia', 'UI', 'PTN Akademik', 'DKI Jakarta'];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([univHeaders, univExample]), 'Universitas');

    const prodiHeaders = ['kode_universitas', 'nama_prodi', 'kode_prodi', 'jenis', 'daya_tampung', 'rata_nilai'];
    const prodiExample = ['UI', 'Teknik Informatika', 'UI-TI', 'Sarjana', '80', '650.5'];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([prodiHeaders, prodiExample]), 'Prodi');

    XLSX.writeFile(wb, 'template-prodi-snbt.xlsx');
  }

  async function deleteUniversity(id: string) {
    if (!confirm('Hapus universitas dan semua prodinya?')) return;
    await supabase.from('universities').delete().eq('id', id);
    await loadData();
  }

  async function deleteProgram(id: string) {
    if (!confirm('Hapus program studi ini?')) return;
    await supabase.from('study_programs').delete().eq('id', id);
    await loadData();
  }

  async function deleteAllData() {
    if (!confirm('AWAS! Anda akan menghapus SEMUA data universitas beserta program studinya. Tindakan ini tidak dapat dibatalkan. Lanjutkan?')) return;
    if (!confirm('Apakah Anda benar-benar yakin ingin mengosongkan tabel universitas dan prodi?')) return;
    setLoading(true);
    
    // Delete study_programs first to avoid FK constraint issues if any, then universities
    await supabase.from('study_programs').delete().not('id', 'is', null);
    const { error } = await supabase.from('universities').delete().not('id', 'is', null);
    
    if (error) {
      alert('Gagal menghapus data: ' + error.message);
    } else {
      alert('Semua data universitas dan prodi berhasil dihapus.');
    }
    
    await loadData();
    setLoading(false);
  }

  const filteredUniversities = universities.filter(u =>
    u.nama_universitas.toLowerCase().includes(search.toLowerCase()) ||
    (u.kode_universitas && u.kode_universitas.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPrograms = programs.filter(p =>
    p.nama_prodi.toLowerCase().includes(search.toLowerCase()) ||
    p.nama_universitas?.toLowerCase().includes(search.toLowerCase())
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
          <Link href="/admin/programs" className={`${adminStyles.navItem} ${adminStyles.navActive}`}>Data Prodi</Link>
          <Link href="/admin/results" className={adminStyles.navItem}>Hasil Peserta</Link>
          <Link href="/admin/violations" className={adminStyles.navItem}>Log Pelanggaran</Link>
        </nav>
      </aside>

      <main className={adminStyles.main}>
        <header className={adminStyles.header}>
          <h1 className={adminStyles.headerTitle}>Data Program Studi</h1>
        </header>

        <div className={adminStyles.content}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="btn btn-primary btn-sm" htmlFor="import-prodi" style={{ cursor: importing ? 'wait' : 'pointer' }}>
              {importing ? 'Mengimpor...' : 'Import Excel / Spreadsheet'}
            </label>
            <input id="import-prodi" type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} disabled={importing} />
            <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>Unduh Template</button>
            <button className="btn btn-danger btn-sm" onClick={deleteAllData}>Hapus Semua Data</button>
            <input
              type="search"
              className="form-input"
              style={{ marginLeft: 'auto', maxWidth: 320 }}
              placeholder="Cari universitas atau prodi..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {importStatus && <div className="alert alert-info">{importStatus}</div>}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className={`btn ${activeTab === 'universities' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => { setActiveTab('universities'); setCurrentPage(1); }}
            >
              Universitas ({filteredUniversities.length})
            </button>
            <button
              className={`btn ${activeTab === 'programs' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => { setActiveTab('programs'); setCurrentPage(1); }}
            >
              Program Studi ({filteredPrograms.length})
            </button>
          </div>

          {activeTab === 'universities' && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nama Universitas</th>
                    <th>Kode</th>
                    <th>Jenis</th>
                    <th>Provinsi</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUniversities.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Belum ada data universitas. Import via Excel / Spreadsheet.</td></tr>
                  )}
                  {filteredUniversities.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.nama_universitas}</td>
                      <td><span className="badge badge-blue">{u.kode_universitas}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.jenis}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.provinsi}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteUniversity(u.id)}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'universities' && filteredUniversities.length > itemsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Sebelumnya</button>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Halaman {currentPage} dari {Math.ceil(filteredUniversities.length / itemsPerPage)}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= Math.ceil(filteredUniversities.length / itemsPerPage)}>Selanjutnya →</button>
            </div>
          )}

          {activeTab === 'programs' && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Program Studi</th>
                    <th>Universitas</th>
                    <th>Jenis</th>
                    <th>Daya Tampung</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Belum ada data prodi.</td></tr>
                  )}
                  {filteredPrograms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.nama_prodi}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.nama_universitas}</td>
                      <td><span className="badge badge-blue">{p.jenis}</span></td>
                      <td>{p.daya_tampung}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteProgram(p.id)}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'programs' && filteredPrograms.length > itemsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Sebelumnya</button>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Halaman {currentPage} dari {Math.ceil(filteredPrograms.length / itemsPerPage)}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= Math.ceil(filteredPrograms.length / itemsPerPage)}>Selanjutnya →</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
