'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from '../auth.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Email atau password salah. Periksa kembali data Anda.');
      setLoading(false);
      return;
    }

    if (authData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      if (profile?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
    router.refresh();
  }

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
          <h1 className={styles.title}>Masuk ke Akun</h1>
          <p className={styles.subtitle}>Gunakan email dan password yang sudah terdaftar.</p>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Masuk'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Belum punya akun?{' '}
            <Link href="/auth/register">Daftar sekarang</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
