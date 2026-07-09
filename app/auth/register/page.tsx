'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from '../auth.module.css';

function generateNomorPeserta(): string {
  const year = '26';
  const loc = String(Math.floor(Math.random() * 9000) + 1000);
  const seq = String(Math.floor(Math.random() * 900000) + 100000);
  return `${year}-${loc}-${seq}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nama: '',
    nisn: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    asal_sekolah: '',
    npsn: '',
  });

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function validateStep1() {
    if (!form.email || !form.password || !form.confirmPassword) {
      setError('Semua field harus diisi.');
      return false;
    }
    if (form.password.length < 8) {
      setError('Password minimal 8 karakter.');
      return false;
    }
    if (form.password !== form.confirmPassword) {
      setError('Password tidak cocok.');
      return false;
    }
    return true;
  }

  function validateStep2() {
    if (!form.nama || !form.nisn || !form.tempat_lahir || !form.tanggal_lahir) {
      setError('Semua field harus diisi.');
      return false;
    }
    if (form.nisn.length !== 10) {
      setError('NISN harus 10 digit.');
      return false;
    }
    return true;
  }

  function nextStep() {
    setError('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(prev => prev + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.asal_sekolah || !form.npsn) {
      setError('Semua field harus diisi.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const nomorPeserta = generateNomorPeserta();

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          nama: form.nama,
          role: 'user',
          nisn: form.nisn,
          tempat_lahir: form.tempat_lahir,
          tanggal_lahir: form.tanggal_lahir,
          asal_sekolah: form.asal_sekolah,
          npsn: form.npsn,
          nomor_peserta_utbk: nomorPeserta,
        },
      },
    });

    if (authError) {
      setError(authError.message === 'User already registered'
        ? 'Email sudah terdaftar.'
        : `Terjadi kesalahan: ${authError.message}`);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  const steps = ['Akun', 'Data Diri', 'Sekolah'];

  return (
    <main className={styles.page}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.bgOrb} />
      </div>
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.backLink}>Kembali ke beranda</Link>
          <div className={styles.logo}>
            <img src="/logo.png" alt="Logo" className={styles.logoImg} />
            <span className={styles.logoText}>TryoutSNBT</span>
          </div>
          <h1 className={styles.title}>Buat Akun Baru</h1>

          <div className={styles.steps}>
            {steps.map((s, i) => (
              <div key={s} className={`${styles.stepItem} ${step > i + 1 ? styles.stepDone : ''} ${step === i + 1 ? styles.stepActive : ''}`}>
                <div className={styles.stepNum}>{step > i + 1 ? '✓' : i + 1}</div>
                <span className={styles.stepLabel}>{s}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className={styles.form}>
              <div className="form-group">
                <label htmlFor="reg-email" className="form-label">Email</label>
                <input id="reg-email" type="email" className="form-input" placeholder="nama@email.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="reg-password" className="form-label">Password</label>
                <input id="reg-password" type="password" className="form-input" placeholder="Minimal 8 karakter" value={form.password} onChange={(e) => set('password', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="reg-confirm" className="form-label">Konfirmasi Password</label>
                <input id="reg-confirm" type="password" className="form-input" placeholder="Ulangi password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} />
              </div>
              <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={nextStep}>Lanjut</button>
            </div>
          )}

          {step === 2 && (
            <div className={styles.form}>
              <div className="form-group">
                <label htmlFor="reg-nama" className="form-label">Nama Lengkap</label>
                <input id="reg-nama" type="text" className="form-input" placeholder="Sesuai ijazah" value={form.nama} onChange={(e) => set('nama', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="reg-nisn" className="form-label">NISN (10 digit)</label>
                <input id="reg-nisn" type="text" className="form-input" placeholder="0000000000" maxLength={10} value={form.nisn} onChange={(e) => set('nisn', e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className={styles.row2}>
                <div className="form-group">
                  <label htmlFor="reg-tempat" className="form-label">Tempat Lahir</label>
                  <input id="reg-tempat" type="text" className="form-input" placeholder="Kota lahir" value={form.tempat_lahir} onChange={(e) => set('tempat_lahir', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-tgl" className="form-label">Tanggal Lahir</label>
                  <input id="reg-tgl" type="date" className="form-input" value={form.tanggal_lahir} onChange={(e) => set('tanggal_lahir', e.target.value)} />
                </div>
              </div>
              <div className={styles.btnRow}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Kembali</button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={nextStep}>Lanjut</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className="form-group">
                <label htmlFor="reg-sekolah" className="form-label">Nama Sekolah</label>
                <input id="reg-sekolah" type="text" className="form-input" placeholder="Nama SMA/MA/SMK" value={form.asal_sekolah} onChange={(e) => set('asal_sekolah', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="reg-npsn" className="form-label">NPSN Sekolah (8 digit)</label>
                <input id="reg-npsn" type="text" className="form-input" placeholder="00000000" maxLength={8} value={form.npsn} onChange={(e) => set('npsn', e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className={styles.btnRow}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Kembali</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Daftar'}
                </button>
              </div>
            </form>
          )}

          <p className={styles.switchLink}>
            Sudah punya akun?{' '}
            <Link href="/auth/login">Masuk sekarang</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
