'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { StudyProgram, University } from '@/types';
import styles from './programs.module.css';
import dashStyles from '../dashboard.module.css';

interface ProgramWithUniversity extends StudyProgram {
  university: University;
}

type ProgramType = 'Sarjana' | 'D4' | 'D3';

function validateSelections(programs: (ProgramWithUniversity | null)[]): string | null {
  const selected = programs.filter(Boolean) as ProgramWithUniversity[];
  const count = selected.length;
  if (count === 0) return 'Anda harus memilih minimal 1 program studi.';

  const sarjana = selected.filter(p => p.jenis === 'Sarjana').length;
  const d4 = selected.filter(p => p.jenis === 'D4').length;
  const d3 = selected.filter(p => p.jenis === 'D3').length;
  const akademik = sarjana;
  const vokasi = d4 + d3;

  if (count === 3) {
    const validCombos = [
      akademik === 2 && vokasi === 1,
      akademik === 1 && vokasi === 2,
      vokasi === 3 && d3 >= 1,
    ];
    if (!validCombos.some(Boolean)) {
      return '3 pilihan: harus 2 akademik + 1 vokasi, atau 1 akademik + 2 vokasi, atau 3 vokasi dengan min 1 D3.';
    }
  }

  if (count === 4) {
    const validCombos = [
      akademik === 2 && vokasi === 2 && d3 >= 1,
      akademik === 1 && vokasi === 3 && d3 >= 1,
    ];
    if (!validCombos.some(Boolean)) {
      return '4 pilihan: harus 2 akademik + 2 vokasi (min 1 D3), atau 1 akademik + 3 vokasi (min 1 D3).';
    }
  }

  return null;
}

export default function ProgramsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [allPrograms, setAllPrograms] = useState<ProgramWithUniversity[]>([]);
  const [selections, setSelections] = useState<(ProgramWithUniversity | null)[]>([null, null, null, null]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterUniv, setFilterUniv] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userId, setUserId] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    setUserId(user.id);

    const fetchAll = async (table: string, select: string, orderColumn: string) => {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .order(orderColumn)
          .order('id')
          .range(from, from + step - 1);
          
        if (error || !data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < step) break;
        from += step;
      }
      
      const seen = new Set();
      return allData.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    const [progsRes, selRes, sessRes] = await Promise.all([
      fetchAll('study_programs', '*, university:universities(*)', 'nama_prodi'),
      supabase.from('program_selections').select(`
        pilihan_1:study_programs!pilihan_1(*, university:universities(*)),
        pilihan_2:study_programs!pilihan_2(*, university:universities(*)),
        pilihan_3:study_programs!pilihan_3(*, university:universities(*)),
        pilihan_4:study_programs!pilihan_4(*, university:universities(*))
      `).eq('user_id', user.id).maybeSingle(),
      supabase.from('exam_sessions').select('id').eq('user_id', user.id).limit(1).maybeSingle(),
    ]);

    setAllPrograms(progsRes as ProgramWithUniversity[]);

    let sd: Record<string, unknown> = {};
    if (selRes.data) {
      sd = selRes.data as Record<string, unknown>;
    }

    if (sessRes.data) {
      const hasSelection = sd.pilihan_1 || sd.pilihan_2 || sd.pilihan_3 || sd.pilihan_4;
      if (hasSelection) {
        setIsLocked(true);
      }
    }

    if (selRes.data) {
      setSelections([
        (sd.pilihan_1 as ProgramWithUniversity | null) ?? null,
        (sd.pilihan_2 as ProgramWithUniversity | null) ?? null,
        (sd.pilihan_3 as ProgramWithUniversity | null) ?? null,
        (sd.pilihan_4 as ProgramWithUniversity | null) ?? null,
      ]);
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveSelections() {
    setError('');
    const validationError = validateSelections(selections);
    if (validationError) { setError(validationError); return; }

    const confirmSave = window.confirm('Apakah Anda yakin ingin menyimpan permanen pilihan program studi ini? Setelah disimpan permanen, Anda tidak dapat mengubah pilihan prodi lagi dan siap memulai tryout.');
    if (!confirmSave) return;

    setSaving(true);
    const payload = {
      user_id: userId,
      pilihan_1: selections[0]?.id ?? null,
      pilihan_2: selections[1]?.id ?? null,
      pilihan_3: selections[2]?.id ?? null,
      pilihan_4: selections[3]?.id ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: err } = await supabase.from('program_selections').upsert(payload, { onConflict: 'user_id' });
    if (err) {
      console.error(err);
      setError('Gagal menyimpan pilihan: ' + err.message);
    } else {
      // Lock it by creating a pending exam_sessions row
      const { error: sessionErr } = await supabase.from('exam_sessions').insert({
        user_id: userId,
        status: 'pending',
      });
      if (sessionErr) {
        console.error(sessionErr);
        setError('Gagal mengunci pilihan permanen: ' + sessionErr.message);
      } else {
        setIsLocked(true);
        setSuccess('Pilihan program studi berhasil disimpan permanen.');
        setTimeout(() => setSuccess(''), 3000);
      }
    }
    setSaving(false);
  }

  function selectProgram(program: ProgramWithUniversity) {
    if (activeSlot === null) return;
    const already = selections.findIndex(s => s?.id === program.id);
    if (already !== -1 && already !== activeSlot) {
      setError('Program studi ini sudah dipilih di pilihan lain.');
      return;
    }
    setError('');
    const next = [...selections];
    next[activeSlot] = program;
    setSelections(next);
    setActiveSlot(null);
  }

  function clearSlot(idx: number) {
    const next = [...selections];
    next[idx] = null;
    setSelections(next);
  }

  const universities = [...new Set(allPrograms.map(p => p.university.nama_universitas))].sort();

  const filtered = allPrograms.filter(p => {
    const matchSearch = !search || p.nama_prodi.toLowerCase().includes(search.toLowerCase()) || p.university.nama_universitas.toLowerCase().includes(search.toLowerCase());
    const matchJenis = !filterJenis || p.jenis === filterJenis;
    const matchUniv = !filterUniv || p.university.nama_universitas === filterUniv;
    return matchSearch && matchJenis && matchUniv;
  });

  const jenisLabels: Record<ProgramType, string> = { Sarjana: 'Akademik', D4: 'Vokasi', D3: 'Vokasi' };

  if (loading) return <div className="page-loader"><div className="spinner spinner-lg" /></div>;

  return (
    <div className={dashStyles.layout}>
      {isSidebarOpen && (
        <div 
          className={dashStyles.sidebarOverlay} 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`${dashStyles.sidebar} ${isSidebarOpen ? dashStyles.sidebarOpen : ''}`}>
        <div className={dashStyles.sidebarLogo}>
          <img src="/logo.png" alt="Logo" className={dashStyles.sideLogoImg} />
          <span>TryoutSNBT</span>
        </div>
        <nav className={dashStyles.sideNav}>
          <Link href="/dashboard" className={dashStyles.navItem}>Dashboard</Link>
          <Link href="/dashboard/programs" className={`${dashStyles.navItem} ${dashStyles.navActive}`}>Pilihan Prodi</Link>
          <Link href="/certificate" className={dashStyles.navItem}>Sertifikat</Link>
        </nav>
      </aside>

      <main className={dashStyles.main}>
        <header className={dashStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className={dashStyles.hamburgerBtn}
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <div>
              <h1 className={dashStyles.headerTitle}>Pilihan Program Studi</h1>
              <p className={dashStyles.headerSub}>Pilih 1-4 program studi sesuai ketentuan SNBT</p>
            </div>
          </div>
          {!isLocked && (
            <button className="btn btn-primary btn-lg" onClick={saveSelections} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
              {saving ? <span className="spinner" /> : '💾 Simpan Permanen'}
            </button>
          )}
        </header>

        <div className={`${dashStyles.content} ${styles.content}`}>
          <div className={styles.selectionsRow}>
            {[0, 1, 2, 3].map(idx => (
              <div key={idx} className={`${styles.slot} ${activeSlot === idx ? styles.slotActive : ''}`}>
                <div className={styles.slotLabel}>Pilihan {idx + 1}</div>
                {selections[idx] ? (
                  <div className={styles.slotFilled}>
                    <div className={styles.slotProdi}>{selections[idx]!.nama_prodi}</div>
                    <div className={styles.slotUniv}>{selections[idx]!.university.nama_universitas}</div>
                    <div className={styles.slotMeta}>
                      <span className="badge badge-blue">{selections[idx]!.jenis}</span>
                      <span className={styles.slotKelompok}>{jenisLabels[selections[idx]!.jenis as ProgramType]}</span>
                    </div>
                    {!isLocked && (
                      <div className={styles.slotActions}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setActiveSlot(idx)}>Ganti</button>
                        <button className="btn btn-danger btn-sm" onClick={() => clearSlot(idx)}>Hapus</button>
                      </div>
                    )}
                  </div>
                ) : (
                  !isLocked ? (
                    <button className={styles.slotEmpty} onClick={() => setActiveSlot(idx)}>
                      {activeSlot === idx ? 'Pilih dari daftar...' : 'Klik untuk memilih'}
                    </button>
                  ) : (
                    <div className={styles.slotEmpty} style={{ cursor: 'default' }}>Tidak Memilih</div>
                  )
                )}
              </div>
            ))}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          
          {isLocked && (
            <div className="alert alert-success" style={{ fontWeight: 'bold' }}>
              ✓ Pilihan program studi Anda telah disimpan permanen dan tidak dapat diubah lagi. Anda kini siap memulai tryout dari menu Dashboard.
            </div>
          )}

          <div className={styles.rulesBox}>
            <strong>Ketentuan Pilihan:</strong> 1-2 pilihan bebas. 3 pilihan: 2 akademik + 1 vokasi, atau 1 akademik + 2 vokasi. 4 pilihan: 2 akademik + 2 vokasi (min 1 D3), atau 1 akademik + 3 vokasi (min 1 D3).
          </div>

          <div className={styles.filterRow}>
            <input
              type="search"
              className="form-input"
              placeholder="Cari prodi atau universitas..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
            <select className="form-select" value={filterJenis} onChange={(e) => { setFilterJenis(e.target.value); setCurrentPage(1); }}>
              <option value="">Semua Jenis</option>
              <option value="Sarjana">Sarjana</option>
              <option value="D4">D4 / Sarjana Terapan</option>
              <option value="D3">D3</option>
            </select>
            <select className="form-select" value={filterUniv} onChange={(e) => { setFilterUniv(e.target.value); setCurrentPage(1); }}>
              <option value="">Semua Universitas</option>
              {universities.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {activeSlot !== null && (
            <div className="alert alert-info">
              Memilih untuk Pilihan {activeSlot + 1}. Klik program studi di bawah untuk dipilih.
            </div>
          )}

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
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Tidak ada program studi ditemukan</td></tr>
                )}
                {filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(p => {
                  const isSelected = selections.some(s => s?.id === p.id);
                  return (
                    <tr key={p.id} className={isSelected ? styles.selectedRow : ''}>
                      <td style={{ fontWeight: 500 }}>{p.nama_prodi}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.university.nama_universitas}</td>
                      <td><span className="badge badge-blue">{p.jenis}</span></td>
                      <td>{p.daya_tampung}</td>
                      <td>
                        {isSelected
                          ? <span className="badge badge-green">Terpilih</span>
                          : isLocked
                            ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Terkunci</span>
                            : activeSlot !== null
                              ? <button className="btn btn-primary btn-sm" onClick={() => selectProgram(p)}>Pilih</button>
                              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Klik slot pilihan dulu</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > itemsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Sebelumnya
              </button>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Halaman {currentPage} dari {Math.ceil(filtered.length / itemsPerPage)} ({filtered.length} total prodi)
              </span>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= Math.ceil(filtered.length / itemsPerPage)}
              >
                Selanjutnya →
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
