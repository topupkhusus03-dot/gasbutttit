'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './seb.module.css';

export default function SebSplashScreen() {
  const router = useRouter();
  const [latency, setLatency] = useState(42);
  const [ip, setIp] = useState('10.6.6.234');

  useEffect(() => {
    // Simulate fetching IP and latency
    setIp(`10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`);
    setLatency(Math.floor(Math.random() * 50) + 10);
  }, []);

  const handleExit = () => {
    if (confirm('Apakah Anda yakin ingin keluar dari Aplikasi Ujian?')) {
      window.close();
    }
  };

  const handleEnter = () => {
    router.push('/auth/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.subtitle}>Ujian Tulis Berbasis Komputer</div>
          <h1 className={styles.title}>Aplikasi Ujian</h1>
        </div>

        <div className={styles.versionInfo}>
          <div className={styles.infoBox}>
            <strong>Versi</strong> 6.2.5
          </div>
          <div className={styles.infoBox}>
            <strong>Server</strong> 9990101
          </div>
        </div>

        <div className={styles.networkInfo}>
          <div className={styles.ipBox}>{ip}</div>
          <div className={styles.latencyBox}>{latency} ms</div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnExit} onClick={handleExit}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Keluar
          </button>
          
          <button className={styles.btnEnter} onClick={handleEnter}>
            Masuk
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <strong>DAILY STUDY</strong>
        <div>Tryout UTBK SNBT 2027</div>
      </div>
    </div>
  );
}
