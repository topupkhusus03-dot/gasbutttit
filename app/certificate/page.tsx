'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { User, ExamResult, ExamSession } from '@/types';
import styles from './certificate.module.css';

function pad2(n: number) { return String(n).padStart(2, '0'); }

function formatTanggal(iso: string) {
  const d = new Date(iso);
  const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTanggalLahir(iso: string) {
  const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  const parts = iso.split('-');
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

function formatSkor(n: number | null | undefined) {
  if (!n) return '0,00';
  return n.toFixed(2).replace('.', ',');
}

export default function CertificatePage() {
  const router = useRouter();
  const supabase = createClient();
  const certRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [garudaSrc, setGarudaSrc] = useState('');
  const [logoSrc, setLogoSrc] = useState('');

  const generateQR = useCallback(async (text: string, logoDataUrl: string, canvasNode: HTMLCanvasElement) => {
    if (!canvasNode) return;
    const QRCode = (await import('qrcode')).default;
    
    // Using a callback to ensure it works regardless of promise support
    QRCode.toCanvas(canvasNode, text, {
      width: 220,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }, (err) => {
      if (err) console.error(err);
      
      if (logoDataUrl && !err) {
        const ctx = canvasNode.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.src = logoDataUrl;
          img.onload = () => {
            const size = 50;
            const center = 220 / 2;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(center - size/2 - 2, center - size/2 - 2, size + 4, size + 4);
            ctx.drawImage(img, center - size/2, center - size/2, size, size);
          };
        }
      }
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      // Check if announcement is open
      const { data: settings } = await supabase.from('global_settings').select('value').eq('key', 'snbt_announcement_time').maybeSingle();
      if (settings && settings.value) {
        if (Date.now() < new Date(settings.value).getTime()) {
          router.replace('/dashboard');
          return;
        }
      } else {
        router.replace('/dashboard');
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const [profileRes, sessionRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', authUser.id).single(),
        supabase.from('exam_sessions').select('*').eq('user_id', authUser.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setUser(profileRes.data);
      setSession(sessionRes.data);

      let base64Logo = '';
      try {
        const logoRes = await fetch('/logo.png');
        const logoBlob = await logoRes.blob();
        base64Logo = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        setLogoSrc(base64Logo);
      } catch (e) {
        console.error('Failed to load Logo:', e);
      }

      if (sessionRes.data) {
        const { data: resultData } = await supabase
          .from('exam_results')
          .select('*')
          .eq('session_id', sessionRes.data.id)
          .single();
        setResult(resultData);
      }

      try {
        const svgRes = await fetch('/garuda.svg');
        const svgText = await svgRes.text();
        setGarudaSrc('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText))));
      } catch (e) {
        console.error('Failed to load Garuda:', e);
      }

      setLoading(false);
    }
    fetchData();
  }, [supabase, generateQR]);


  async function handleDownloadPDF() {
    if (!certRef.current || !result) return;
    setDownloading(true);

    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');

    const canvas = await html2canvas(certRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth(); // 297mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width; // Maintain aspect ratio
    
    // Center it vertically if it doesn't fill height perfectly (though 1122x793 is exactly A4)
    const yPos = (pdf.internal.pageSize.getHeight() - pdfHeight) / 2;
    
    pdf.addImage(imgData, 'PNG', 0, yPos, pdfWidth, pdfHeight);
    pdf.save(`sertifikat-utbk-${user?.nomor_peserta_utbk ?? 'snbt'}.pdf`);

    setDownloading(false);
  }

  if (loading) {
    return <div className="page-loader"><div className="spinner spinner-lg" /><span>Memuat sertifikat...</span></div>;
  }

  if (!result || !session) {
    return (
      <div className="page-loader">
        <p style={{ color: 'var(--text-secondary)' }}>Sertifikat belum tersedia. Selesaikan tryout terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        <a href="/dashboard" className="btn btn-secondary">Kembali ke Dashboard</a>
        <button className="btn btn-primary" onClick={handleDownloadPDF} disabled={downloading}>
          {downloading ? <><span className="spinner" /> Mengunduh...</> : 'Unduh PDF'}
        </button>
      </div>

      <div className={styles.certWrapper}>
        <div ref={certRef} className={styles.cert}>
          <div className={styles.certHeader}>
            <div className={styles.certLogos}>
              {logoSrc && <img src={logoSrc} alt="Logo" className={styles.certLogoLeft} />}
            </div>
            <div className={styles.certTitle}>
              <div className={styles.certTitleMain}>SERTIFIKAT HASIL</div>
              <div className={styles.certTitleSub}>TRYOUT UJIAN TULIS BERBASIS KOMPUTER (UTBK 2027)</div>
            </div>
            <div className={styles.certTitleDivider} />
          </div>

          <div className={styles.certBody}>
            {garudaSrc && <img src={garudaSrc} alt="" className={styles.certGarudaBg} aria-hidden="true" />}

            <div className={styles.certInfo}>
              <table className={styles.certTable}>
                <tbody>
                  <tr>
                    <td className={styles.certInfoLabel}>Nama</td>
                    <td className={styles.certInfoColon}>:</td>
                    <td className={styles.certInfoValue}>{user?.nama?.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td className={styles.certInfoLabel}>Tempat / Tanggal Lahir</td>
                    <td className={styles.certInfoColon}>:</td>
                    <td className={styles.certInfoValue}>
                      {user?.tempat_lahir?.toUpperCase()} / {user?.tanggal_lahir ? formatTanggalLahir(user.tanggal_lahir) : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.certInfoLabel}>Nomor Induk Siswa Nasional</td>
                    <td className={styles.certInfoColon}>:</td>
                    <td className={styles.certInfoValue}>{user?.nisn?.split('').join(' ')}</td>
                  </tr>
                  <tr>
                    <td className={styles.certInfoLabel}>Asal Sekolah / NPSN</td>
                    <td className={styles.certInfoColon}>:</td>
                    <td className={styles.certInfoValue}>
                      {user?.asal_sekolah?.toUpperCase()} / {user?.npsn?.split('').join(' ')}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.certInfoLabel}>Nomor Peserta UTBK</td>
                    <td className={styles.certInfoColon}>:</td>
                    <td className={styles.certInfoValue}>{user?.nomor_peserta_utbk?.split('').join(' ')}</td>
                  </tr>
                </tbody>
              </table>
              {user?.foto_url ? (
                <img src={user.foto_url} alt="Foto peserta" className={styles.certPhoto} />
              ) : (
                <div className={styles.certPhotoPlaceholder} />
              )}
            </div>

            <p className={styles.certStatement}>
              Telah mengikuti UTBK pada tanggal {formatTanggal(session.tanggal_tes)} dan berlaku untuk evaluasi tryout 2027 dengan hasil sebagai berikut:
            </p>

            <div className={styles.certScores}>
              <div className={styles.certQR}>
                <canvas ref={(node) => {
                  if (node && user?.nomor_peserta_utbk && logoSrc !== undefined) {
                    generateQR(`UTBK-SNBT-2027:${user.nomor_peserta_utbk}`, logoSrc, node);
                  }
                }} />
              </div>

              <div className={styles.certScoreContent}>
                <div className={styles.certScoreGroup}>
                  <div className={styles.certScoreGroupTitle}>Tes Potensi Skolastik (TPS):</div>
                  <div className={styles.certScoreRow}>
                    <span className={styles.certScoreName}>Penalaran Umum</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_penalaran_umum)}</span>
                  </div>
                  <div className={styles.certScoreRow}>
                    <span className={styles.certScoreName}>Pengetahuan dan Pemahaman Umum</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_ppu)}</span>
                  </div>
                  <div className={styles.certScoreRow}>
                    <span className={styles.certScoreName}>Pemahaman Bacaan dan Menulis</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_pbm)}</span>
                  </div>
                  <div className={styles.certScoreRow}>
                    <span className={styles.certScoreName}>Pengetahuan Kuantitatif</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_pk)}</span>
                  </div>
                </div>

                <div className={styles.certScoreGroup}>
                  <div className={styles.certScoreGroupTitle}>Tes Literasi:</div>
                  <div className={styles.certScoreRow}>
                    <span className={styles.certScoreName}>Literasi dalam Bahasa Indonesia</span>
                    <span className={styles.certScoreVal}></span>
                  </div>
                  <div className={styles.certScoreRowIndent}>
                    <span className={styles.certScoreName}>- Saintek</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_literasi_id_saintek)}</span>
                  </div>
                  <div className={styles.certScoreRowIndent}>
                    <span className={styles.certScoreName}>- Soshum</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_literasi_id_soshum)}</span>
                  </div>
                  <div className={styles.certScoreRow}>
                    <span className={styles.certScoreName}>Literasi dalam Bahasa Inggris</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_literasi_en)}</span>
                  </div>
                  <div className={styles.certScoreRow}>
                    <span className={styles.certScoreName}>Penalaran Matematika</span>
                    <span className={styles.certScoreVal}>{formatSkor(result.skor_penalaran_matematika)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
