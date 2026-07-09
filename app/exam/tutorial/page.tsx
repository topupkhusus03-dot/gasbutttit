'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import styles from '../exam.module.css';

export default function TutorialPage() {
  const router = useRouter();
  const [qType, setQType] = useState<'single' | 'multi' | 'complex' | 'short'>('single');
  const [zoomFactor, setZoomFactor] = useState(100);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tutorialCompleted', 'true');
    }
    const driverObj = driver({
      showProgress: true,
      doneBtnText: 'Selesai',
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      allowClose: false,
      steps: [
        { popover: { title: 'Selamat Datang', description: 'Berikut adalah tutorial dari penggunaan aplikasi ketika ujian sedang berlangsung.', align: 'center' } },
        { element: '#tutorial-sidebar-profile', popover: { title: 'Informasi Peserta', description: 'Sidebar berisi foto, nomor, dan nama peserta ujian.', side: 'right', align: 'start' } },
        { element: '#tutorial-header-center', popover: { title: 'Nama Ujian', description: 'Di sini terdapat nama dari ujian dan komponen dari ujian yang sedang berlangsung.', side: 'bottom', align: 'center' } },
        { element: '#tutorial-palette', popover: { title: 'Daftar Soal', description: 'Di bawah nama ujian dan komponen ujian terdapat kotak daftar soal komponen ujian yang sedang berlangsung.', side: 'right', align: 'start' } },
        { element: '#tutorial-ip', popover: { title: 'IP Address', description: 'Informasi tentang IP Address komputer peserta yang terhubung ke server ujian.', side: 'bottom', align: 'end' } },
        { element: '#tutorial-latency', popover: { title: 'Latency', description: 'Informasi tentang latency komputer peserta yang terhubung dengan server ujian.', side: 'bottom', align: 'end' } },
        { element: '#tutorial-timer', popover: { title: 'Sisa Waktu', description: 'Informasi sisa waktu dari subtes yang sedang berlangsung.', side: 'bottom', align: 'end' } },
        { element: '#tutorial-question-num', popover: { title: 'Nomor Soal', description: 'Informasi tentang nomor soal pada subtes.', side: 'bottom', align: 'start' } },
        { element: '#tutorial-options', popover: { title: 'Memilih Jawaban', description: 'Informasi tentang bagian untuk menjawab, pilih salah satu jawaban untuk melanjutkan.', side: 'right', align: 'start' } },
        { element: '#tutorial-palette-1', popover: { title: 'Status Jawaban', description: 'Jika jawaban sudah dipilih, maka kotak nomor pada daftar soal akan berubah menjadi warna hijau.', side: 'right', align: 'start' } },
        { element: '#tutorial-prev-btn', popover: { title: 'Soal Sebelumnya', description: 'Informasi tentang tombol untuk menampilkan halaman soal sebelumnya.', side: 'top', align: 'center' } },
        { element: '#tutorial-next-btn', popover: { title: 'Soal Selanjutnya', description: 'Informasi tentang tombol untuk menampilkan halaman soal berikutnya, tekan tombol Selanjutnya untuk melanjutkan.', side: 'top', align: 'center' } },
        { element: '#tutorial-palette-3', popover: { title: 'Loncat Soal', description: 'Informasi untuk loncat/pindah ke nomor soal lain dengan cara memilih salah satu nomor soal. Contoh pilih soal nomor 3 untuk loncat.', side: 'right', align: 'start' } },
        { element: '#tutorial-options', popover: { title: 'Pilihan Ganda', description: 'Contoh soal pilihan ganda dengan 1 pilihan jawaban.', side: 'top', align: 'start', onHighlightStarted: () => setQType('single') } },
        { element: '#tutorial-options', popover: { title: 'Pilihan Ganda Kompleks', description: 'Contoh soal pilihan ganda dengan pilihan lebih dari 1 pilihan jawaban.', side: 'top', align: 'start', onHighlightStarted: () => setQType('multi') } },
        { element: '#tutorial-options', popover: { title: 'Pilihan Benar/Salah', description: 'Contoh soal pilihan ganda kompleks.', side: 'top', align: 'start', onHighlightStarted: () => setQType('complex') } },
        { element: '#tutorial-options', popover: { title: 'Isian Singkat', description: 'Contoh soal isian singkat.', side: 'top', align: 'start', onHighlightStarted: () => setQType('short') } },
        { element: '#tutorial-zoom', popover: { title: 'Zoom', description: 'Informasi tombol Zoom untuk memperbesar atau memperkecil tampilan soal.', side: 'top', align: 'center' } },
        { popover: { title: 'Selesai', description: 'Tutorial Selesai. Pilih tombol Selesai untuk mengakhiri.', align: 'center' } }
      ],
      onDestroyStarted: () => {
        router.push('/exam');
        driverObj.destroy();
      }
    });

    // small delay to ensure DOM is ready before starting the driver
    setTimeout(() => {
      driverObj.drive();
    }, 100);
    
    return () => { driverObj.destroy(); };
  }, [router]);

  return (
    <div className={styles.examLayout} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <header className={styles.examHeader}>
        <div className={styles.examHeaderLeft}>
          <img src="/logo.png" alt="DAILY STUDY" className={styles.headerLogo} />
        </div>
        <div id="tutorial-header-center" className={styles.examHeaderCenter}>
          Tutorial Ujian
        </div>
        <div className={styles.examHeaderRight}>
          <span className={styles.headerMeta}>Tryout UTBK 2027</span>
          <span id="tutorial-ip" className={styles.headerIp}>10.0.0.1</span>
          <span id="tutorial-latency" className={styles.headerLatency}>12 ms</span>
          <span id="tutorial-timer" className={styles.timer}>29:55</span>
        </div>
      </header>

      <div className={styles.examBody}>
        <aside className={styles.examSidebar}>
          <div id="tutorial-sidebar-profile" className={styles.sidebarPhoto}>
            <div className={styles.sidePhotoPlaceholder}>T</div>
            <div className={styles.sideNomor}>26-9999-99-0026</div>
            <div className={styles.sideName}>PESERTA TUTORIAL</div>
          </div>

          <div className={styles.sidebarSubtestInfo}>
            <div className={styles.sideSubtestLabel}>Tryout UTBK 2027</div>
            <div className={styles.sideSubtestName}>Tutorial Ujian</div>
          </div>

          <div className={styles.sidebarPaletteSection}>
            <div className={styles.paletteLegend}>
              <span className={styles.legendAnswered}>Dijawab</span>
              <span className={styles.legendUnanswered}>Belum</span>
              <span className={styles.legendFlagged}>Ragu</span>
            </div>
            <div id="tutorial-palette" className={styles.palette}>
              <button id="tutorial-palette-1" className={`${styles.paletteBtn} ${styles.paletteAnswered}`}>1</button>
              <button className={`${styles.paletteBtn} ${styles.paletteCurrent}`}>2</button>
              <button id="tutorial-palette-3" className={styles.paletteBtn}>3</button>
              <button className={styles.paletteBtn}>4</button>
              <button className={styles.paletteBtn}>5</button>
            </div>
          </div>
        </aside>

        <main className={styles.examMain}>
          <div className={styles.questionArea}>
            <div className={styles.questionHeader}>
              <span id="tutorial-question-num" className={styles.questionNum}>Soal Nomor 2</span>
              <span className={styles.questionOf}>dari 5 soal</span>
            </div>

            <div className={styles.questionText} style={{ fontSize: `${zoomFactor}%` }}>
              <p>Ini adalah contoh konten soal yang ditampilkan saat ujian berlangsung. Bacalah dengan saksama dan pilihlah jawaban yang paling tepat.</p>
            </div>

            <div id="tutorial-options">
              {qType === 'single' && (
                <div className={styles.optionsList}>
                  {['A', 'B', 'C', 'D', 'E'].map(l => (
                    <label key={l} className={styles.optionItem}>
                      <span className={styles.optionRadio}><span className={styles.optionRadioInner} /></span>
                      <span className={styles.optionLetter}>{l}.</span>
                      <span className={styles.optionText}>Contoh pilihan jawaban tunggal {l}</span>
                    </label>
                  ))}
                </div>
              )}
              {qType === 'multi' && (
                <div className={styles.optionsList}>
                  {['A', 'B', 'C', 'D', 'E'].map(l => (
                    <label key={l} className={styles.optionItem}>
                      <span className={styles.optionCheckbox} style={{ borderColor: '#aaa' }} />
                      <span className={styles.optionLetter}>{l}.</span>
                      <span className={styles.optionText}>Contoh pilihan ganda lebih dari 1 jawaban {l}</span>
                    </label>
                  ))}
                </div>
              )}
              {qType === 'complex' && (
                <div className={styles.complexMatrix}>
                  <table className={styles.matrixTable}>
                    <thead>
                      <tr>
                        <th>Pernyataan</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Benar</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Salah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['Pernyataan satu', 'Pernyataan dua', 'Pernyataan tiga'].map((txt, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: '13px', padding: '10px 12px' }}>{txt}</td>
                          <td style={{ textAlign: 'center' }}><input type="radio" name={`m_${i}`} /></td>
                          <td style={{ textAlign: 'center' }}><input type="radio" name={`m_${i}`} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {qType === 'short' && (
                <div className={styles.shortAnswerContainer}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '8px' }}>Jawaban Anda:</label>
                  <input type="text" className="form-input" style={{ maxWidth: '300px' }} placeholder="Ketik jawaban singkat disini..." readOnly />
                </div>
              )}
            </div>
          </div>
          
          <div style={{ padding: '16px', background: '#fff', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div id="tutorial-zoom" style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setZoomFactor(prev => Math.max(50, prev - 10))} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>A-</button>
              <button onClick={() => setZoomFactor(prev => Math.min(200, prev + 10))} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>A+</button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button id="tutorial-prev-btn" className={styles.btnReject}>&lt; Sebelumnya</button>
              <button className={styles.btnFlag}>Ragu-ragu</button>
              <button id="tutorial-next-btn" className={styles.btnAccept}>Selanjutnya &gt;</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
