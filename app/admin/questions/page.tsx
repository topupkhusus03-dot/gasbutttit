'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Question, Subtest } from '@/types';
import * as XLSX from 'xlsx';
import styles from './questions.module.css';
import adminStyles from '../admin.module.css';

interface QuestionForm {
  subtest_id: string;
  nomor: string;
  konten: string;
  gambar_url: string;
  pilihan_a: string;
  pilihan_b: string;
  pilihan_c: string;
  pilihan_d: string;
  pilihan_e: string;
  kunci_jawaban: string;
  parameter_a: string;
  parameter_b: string;
  parameter_c: string;
}

const emptyForm: QuestionForm = {
  subtest_id: '', nomor: '', konten: '', gambar_url: '',
  pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', pilihan_e: '',
  kunci_jawaban: 'A', parameter_a: '1.0', parameter_b: '0.0', parameter_c: '0.25',
};

export default function AdminQuestionsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [subtests, setSubtests] = useState<Subtest[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedSubtest, setSelectedSubtest] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<QuestionForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const loadData = useCallback(async () => {
    const stRes = await supabase.from('subtests').select('*').order('urutan');
    setSubtests(stRes.data ?? []);

    if (selectedSubtest) {
      const qRes = await supabase.from('questions').select('*').eq('subtest_id', selectedSubtest).order('nomor');
      setQuestions(qRes.data ?? []);
    } else {
      const qRes = await supabase.from('questions').select('*').order('nomor');
      setQuestions(qRes.data ?? []);
    }
  }, [supabase, selectedSubtest]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
      await loadData();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadData]);

  function setField(field: keyof QuestionForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function openCreate() {
    setForm({ ...emptyForm, subtest_id: selectedSubtest });
    setEditId(null);
    setShowForm(true);
    setError('');
  }

  function openEdit(q: Question) {
    setForm({
      subtest_id: q.subtest_id,
      nomor: String(q.nomor),
      konten: q.konten,
      gambar_url: q.gambar_url ?? '',
      pilihan_a: q.pilihan_a,
      pilihan_b: q.pilihan_b,
      pilihan_c: q.pilihan_c,
      pilihan_d: q.pilihan_d,
      pilihan_e: q.pilihan_e ?? '',
      kunci_jawaban: q.kunci_jawaban,
      parameter_a: String(q.parameter_a),
      parameter_b: String(q.parameter_b),
      parameter_c: String(q.parameter_c),
    });
    setEditId(q.id);
    setShowForm(true);
    setError('');
  }

  async function handleSave() {
    if (!form.subtest_id || !form.nomor || !form.konten || !form.pilihan_a || !form.pilihan_b || !form.pilihan_c || !form.pilihan_d) {
      setError('Subtes, nomor, konten, dan pilihan A-D wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      subtest_id: form.subtest_id,
      nomor: parseInt(form.nomor),
      konten: form.konten,
      gambar_url: form.gambar_url || null,
      pilihan_a: form.pilihan_a,
      pilihan_b: form.pilihan_b,
      pilihan_c: form.pilihan_c,
      pilihan_d: form.pilihan_d,
      pilihan_e: form.pilihan_e || null,
      kunci_jawaban: form.kunci_jawaban,
      parameter_a: parseFloat(form.parameter_a) || parseFloat((Math.random() * (1.5 - 0.8) + 0.8).toFixed(2)),
      parameter_b: parseFloat(form.parameter_b) || parseFloat((Math.random() * (2 - (-2)) + (-2)).toFixed(2)),
      parameter_c: parseFloat(form.parameter_c) || 0.20,
    };

    const { error: dbErr } = editId
      ? await supabase.from('questions').update(payload).eq('id', editId)
      : await supabase.from('questions').insert(payload);

    if (dbErr) {
      setError(dbErr.message);
    } else {
      setShowForm(false);
      setForm(emptyForm);
      setEditId(null);
      await loadData();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;
    setLoading(true);
    await supabase.from('questions').delete().eq('id', id);
    await loadData();
    setLoading(false);
  }

  async function handleDeleteAllInSubtest() {
    if (!selectedSubtest) return;
    const st = subtests.find(s => s.id === selectedSubtest);
    if (!confirm(`Yakin ingin MENGHAPUS SEMUA SOAL pada subtes ${st?.nama}? Tindakan ini tidak dapat dibatalkan!`)) return;
    
    setLoading(true);
    const { error: err } = await supabase.from('questions').delete().eq('subtest_id', selectedSubtest);
    if (err) {
      alert('Gagal menghapus: ' + err.message);
    } else {
      alert(`Semua soal di subtes ${st?.nama} berhasil dihapus.`);
    }
    await loadData();
    setLoading(false);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Membaca file...');

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    setImportStatus(`Mengimpor ${rows.length} soal...`);
    let success = 0;
    let failed = 0;
    let lastError = '';

    // Normalize keys to lowercase and remove spaces/underscores for robust matching
    const normalizedRows = rows.map(r => {
      const nr: Record<string, any> = {};
      for (const k in r) {
        const cleanKey = k.toLowerCase().replace(/[\s_]+/g, '');
        nr[cleanKey] = r[k];
      }
      return nr;
    });

    for (const row of normalizedRows) {
      const subtestKode = String(row['subtestkode'] || row['subtest'] || '').trim().toUpperCase();
      const st = subtests.find(s => s.kode === subtestKode);
      if (!st) { 
        failed++; 
        if (!lastError) lastError = `Subtest kode '${subtestKode}' tidak valid/kosong.`;
        continue; 
      }

      const { error: err } = await supabase.from('questions').upsert({
        subtest_id: st.id,
        nomor: parseInt(String(row['nomor'] || '0')),
        konten: String(row['konten'] || row['kontenpertanyaan'] || row['pertanyaan'] || ''),
        pilihan_a: String(row['pilihana'] || ''),
        pilihan_b: String(row['pilihanb'] || ''),
        pilihan_c: String(row['pilihanc'] || ''),
        pilihan_d: String(row['pilihand'] || ''),
        pilihan_e: String(row['pilihane'] || '') || null,
        kunci_jawaban: String(row['kuncijawaban'] || row['kunci'] || 'A').trim().toUpperCase(),
        parameter_a: parseFloat(String(row['parama'] || row['parametera'])) || parseFloat((Math.random() * (1.5 - 0.8) + 0.8).toFixed(2)),
        parameter_b: parseFloat(String(row['paramb'] || row['parameterb'])) || parseFloat((Math.random() * (2 - (-2)) + (-2)).toFixed(2)),
        parameter_c: parseFloat(String(row['paramc'] || row['parameterc'])) || 0.20,
      }, { onConflict: 'subtest_id,nomor' });

      if (err) {
        failed++;
        if (!lastError) lastError = err.message;
      } else {
        success++;
      }
    }

    setImportStatus(`Selesai: ${success} berhasil, ${failed} gagal. ${lastError ? 'Error: ' + lastError : ''}`);
    await loadData();
    e.target.value = '';
  }

  function downloadTemplate() {
    const headers = ['subtest_kode', 'nomor', 'konten', 'pilihan_a', 'pilihan_b', 'pilihan_c', 'pilihan_d', 'pilihan_e', 'kunci'];
    const example = ['PU', '1', 'Contoh soal penalaran...', 'Jawaban A', 'Jawaban B', 'Jawaban C', 'Jawaban D', '', 'A'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Soal');
    XLSX.writeFile(wb, 'template-soal-snbt.xlsx');
  }

  const filteredQuestions = selectedSubtest
    ? questions.filter(q => q.subtest_id === selectedSubtest)
    : questions;

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
          <Link href="/admin/questions" className={`${adminStyles.navItem} ${adminStyles.navActive}`}>Manajemen Soal</Link>
          <Link href="/admin/users" className={adminStyles.navItem}>Manajemen User</Link>
          <Link href="/admin/programs" className={adminStyles.navItem}>Data Prodi</Link>
          <Link href="/admin/results" className={adminStyles.navItem}>Hasil Peserta</Link>
          <Link href="/admin/violations" className={adminStyles.navItem}>Log Pelanggaran</Link>
        </nav>
      </aside>

      <main className={adminStyles.main}>
        <header className={adminStyles.header}>
          <h1 className={adminStyles.headerTitle}>Manajemen Soal</h1>
        </header>

        <div className={adminStyles.content}>
          <div className={styles.toolbar}>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedSubtest}
              onChange={(e) => setSelectedSubtest(e.target.value)}
            >
              <option value="">Semua Subtes</option>
              {subtests.map(st => (
                <option key={st.id} value={st.id}>{st.nama} ({st.kode})</option>
              ))}
            </select>
            <div className={styles.toolbarActions}>
              {selectedSubtest && (
                <button className="btn btn-danger btn-sm" onClick={handleDeleteAllInSubtest} style={{ marginRight: 'auto' }}>Hapus Semua Soal Subtes Ini</button>
              )}
              <label className="btn btn-secondary btn-sm" htmlFor="import-file">
                Import Excel / Spreadsheet
              </label>
              <input id="import-file" type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display: 'none' }} />
              <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>Unduh Template</button>
              <button className="btn btn-primary btn-sm" onClick={openCreate}>Tambah Soal</button>
            </div>
          </div>

          {importStatus && (
            <div className="alert alert-info">{importStatus}</div>
          )}

          {showForm && (
            <div className="card">
              <h2 className={styles.formTitle}>{editId ? 'Edit Soal' : 'Tambah Soal'}</h2>
              {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Subtes</label>
                  <select className="form-select" value={form.subtest_id} onChange={(e) => setField('subtest_id', e.target.value)}>
                    <option value="">Pilih Subtes</option>
                    {subtests.map(st => <option key={st.id} value={st.id}>{st.nama}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nomor Soal</label>
                  <input type="number" className="form-input" min="1" value={form.nomor} onChange={(e) => setField('nomor', e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label">Konten Soal</label>
                <textarea className={`form-input ${styles.textarea}`} value={form.konten} onChange={(e) => setField('konten', e.target.value)} placeholder="Tulis soal di sini..." rows={4} />
              </div>
              <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="form-label">URL Gambar (opsional)</label>
                <input type="url" className="form-input" value={form.gambar_url} onChange={(e) => setField('gambar_url', e.target.value)} placeholder="https://..." />
              </div>
              <div className={styles.optionsGrid}>
                {(['a', 'b', 'c', 'd', 'e'] as const).map((l) => (
                  <div key={l} className="form-group">
                    <label className="form-label">Pilihan {l.toUpperCase()}{l === 'e' ? ' (opsional)' : ''}</label>
                    <input type="text" className="form-input" value={form[`pilihan_${l}`]} onChange={(e) => setField(`pilihan_${l}`, e.target.value)} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Kunci Jawaban</label>
                  <input type="text" className="form-input" placeholder="Contoh: A, B, atau B/S" value={form.kunci_jawaban} onChange={(e) => setField('kunci_jawaban', e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className={styles.irtRow}>
                <div className="form-group">
                  <label className="form-label">Parameter a (diskriminasi, 0.5-2.5)</label>
                  <input type="number" className="form-input" step="0.1" min="0.5" max="2.5" value={form.parameter_a} onChange={(e) => setField('parameter_a', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Parameter b (kesulitan, -3 s.d. +3)</label>
                  <input type="number" className="form-input" step="0.1" min="-3" max="3" value={form.parameter_b} onChange={(e) => setField('parameter_b', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Parameter c (guessing, 0-0.35)</label>
                  <input type="number" className="form-input" step="0.01" min="0" max="0.35" value={form.parameter_c} onChange={(e) => setField('parameter_c', e.target.value)} />
                </div>
              </div>
              <div className={styles.formActions}>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner" /> : editId ? 'Simpan Perubahan' : 'Tambah Soal'}
                </button>
              </div>
            </div>
          )}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Subtes</th>
                  <th>Konten</th>
                  <th>Kunci</th>
                  <th>Param IRT</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Belum ada soal</td></tr>
                )}
                {filteredQuestions.map((q) => {
                  const st = subtests.find(s => s.id === q.subtest_id);
                  return (
                    <tr key={q.id}>
                      <td>{q.nomor}</td>
                      <td><span className="badge badge-blue">{st?.kode}</span></td>
                      <td style={{ maxWidth: 300 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                          {q.konten.replace(/<[^>]*>/g, '')}
                        </div>
                      </td>
                      <td><span className="badge badge-green">{q.kunci_jawaban}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        a={q.parameter_a} b={q.parameter_b} c={q.parameter_c}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(q)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(q.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
