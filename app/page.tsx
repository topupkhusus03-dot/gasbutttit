'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import styles from './page.module.css';

const EXAM_DATE = new Date('2026-04-24T08:00:00+07:00');

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, passed: false });

  useEffect(() => {
    function calc() {
      const now = Date.now();
      const diff = target.getTime() - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, passed: true });
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, passed: false });
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [target]);

  return timeLeft;
}

export default function HomePage() {
  const countdown = useCountdown(EXAM_DATE);

  const subtests = [
    {
      group: 'Tes Potensi Skolastik (TPS)',
      color: 'blue',
      items: [
        { name: 'Penalaran Umum', soal: '30 soal', waktu: '30 menit' },
        { name: 'Pengetahuan dan Pemahaman Umum', soal: '20 soal', waktu: '15 menit' },
        { name: 'Pemahaman Bacaan dan Menulis', soal: '20 soal', waktu: '25 menit' },
        { name: 'Pengetahuan Kuantitatif', soal: '20 soal', waktu: '20 menit' },
      ],
    },
    {
      group: 'Tes Literasi',
      color: 'indigo',
      items: [
        { name: 'Literasi dalam Bahasa Indonesia', soal: '30 soal', waktu: '42 menit' },
        { name: 'Literasi dalam Bahasa Inggris', soal: '20 soal', waktu: '20 menit' },
        { name: 'Penalaran Matematika', soal: '20 soal', waktu: '42 menit' },
      ],
    },
  ];

  const features = [
    {
      title: 'Penilaian IRT',
      desc: 'Skor dihitung menggunakan Item Response Theory 3PL yang sama dengan UTBK sesungguhnya.',
    },
    {
      title: 'Anti-Kecurangan',
      desc: 'Sistem keamanan fullscreen, deteksi pindah tab, dan token sesi terenkripsi.',
    },
    {
      title: 'Sertifikat Resmi',
      desc: 'Hasil tryout disajikan dalam format sertifikat identik dengan UTBK-SNBT 2026.',
    },
    {
      title: 'Prediksi Kelulusan',
      desc: 'Estimasi peluang diterima di prodi pilihan berdasarkan nilai IRT dan daya tampung.',
    },
  ];

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <div className={`container ${styles.navInner}`}>
          <Link href="/" className={styles.navLogo}>
            <img src="/logo.png" alt="Logo SNBT" className={styles.logoImg} />
            <span>TryoutSNBT</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="/auth/login" className="btn btn-secondary btn-sm">Masuk</Link>
            <Link href="/auth/register" className="btn btn-primary btn-sm">Daftar</Link>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true">
          <div className={styles.heroBgOrb1} />
          <div className={styles.heroBgOrb2} />
          <div className={styles.heroBgGrid} />
        </div>
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroBadge}>UTBK-SNBT 2026</div>
          <h1 className={styles.heroTitle}>
            Platform Tryout<br />
            <span className="text-gradient">SNBT Terbaik</span>
          </h1>
          <p className={styles.heroDesc}>
            Latihan soal dengan sistem penilaian IRT yang akurat, waktu ujian nyata 195 menit,
            dan sertifikat hasil identik dengan UTBK sesungguhnya.
          </p>
          <div className={styles.heroCta}>
            <Link href="/auth/register" className="btn btn-primary btn-lg">
              Mulai Tryout Gratis
            </Link>
            <Link href="/auth/login" className="btn btn-secondary btn-lg">
              Sudah Punya Akun
            </Link>
          </div>

          <div className={styles.countdown}>
            <p className={styles.countdownLabel}>
              {countdown.passed ? 'UTBK-SNBT 2026 telah dilaksanakan' : 'Menuju UTBK-SNBT 2026'}
            </p>
            {!countdown.passed && (
              <div className={styles.countdownGrid}>
                {[
                  { val: countdown.days, label: 'Hari' },
                  { val: countdown.hours, label: 'Jam' },
                  { val: countdown.minutes, label: 'Menit' },
                  { val: countdown.seconds, label: 'Detik' },
                ].map((item) => (
                  <div key={item.label} className={styles.countdownItem}>
                    <span className={styles.countdownNum}>
                      {String(item.val).padStart(2, '0')}
                    </span>
                    <span className={styles.countdownUnit}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.subtestSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Materi Ujian</h2>
            <p className={styles.sectionDesc}>
              Total 195 menit untuk menyelesaikan 7 subtes dengan penilaian IRT per subtes
            </p>
          </div>
          <div className={styles.subtestGrid}>
            {subtests.map((group) => (
              <div key={group.group} className={`${styles.subtestCard} ${styles[`subtestCard_${group.color}`]}`}>
                <h3 className={styles.subtestGroupTitle}>{group.group}</h3>
                <ul className={styles.subtestList}>
                  {group.items.map((item) => (
                    <li key={item.name} className={styles.subtestItem}>
                      <div className={styles.subtestItemLeft}>
                        <div className={styles.subtestDot} />
                        <span className={styles.subtestName}>{item.name}</span>
                      </div>
                      <div className={styles.subtestMeta}>
                        <span>{item.soal}</span>
                        <span>{item.waktu}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Keunggulan Platform</h2>
          </div>
          <div className={styles.featuresGrid}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>Siap Menghadapi SNBT 2026?</h2>
            <p className={styles.ctaDesc}>
              Daftar sekarang dan mulai latihan dengan sistem yang sama seperti ujian aslinya.
            </p>
            <Link href="/auth/register" className="btn btn-primary btn-lg">
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className="container">
          <p className={styles.footerText}>
            TryoutSNBT bukan bagian resmi dari SNPMB. Platform ini dibuat untuk keperluan latihan.
          </p>
        </div>
      </footer>
    </main>
  );
}
