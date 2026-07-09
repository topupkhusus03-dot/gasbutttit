'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';

function PengumumanHasilContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!id) {
      router.replace('/pengumuman');
      return;
    }

    async function fetchData() {
      const supabase = createClient();
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!profile) {
        router.replace('/pengumuman');
        return;
      }

      const { data: result } = await supabase.from('exam_results').select('*').eq('user_id', id).maybeSingle();
      if (!result) {
        setData({ profile, status: 'NOT_TAKEN' });
        setLoading(false);
        return;
      }

      const { data: selection } = await supabase
        .from('program_selections')
        .select(`
          *,
          pilihan_1:study_programs!pilihan_1(*, university:universities(*)),
          pilihan_2:study_programs!pilihan_2(*, university:universities(*)),
          pilihan_3:study_programs!pilihan_3(*, university:universities(*)),
          pilihan_4:study_programs!pilihan_4(*, university:universities(*))
        `)
        .eq('user_id', id)
        .maybeSingle();

      const totalScore = 
        (result.skor_penalaran_umum || 0) +
        (result.skor_ppu || 0) +
        (result.skor_pbm || 0) +
        (result.skor_pk || 0) +
        (result.skor_literasi_id_saintek || 0) +
        (result.skor_literasi_id_soshum || 0) +
        (result.skor_literasi_en || 0) +
        (result.skor_penalaran_matematika || 0);
      
      const averageScore = totalScore / 7; 
      let status = 'FAILED';
      let acceptedProgram = null;
      let acceptedChoiceIndex = 0;

      if (selection) {
        const choices = [
          { data: selection.pilihan_1, penalty: 0 },
          { data: selection.pilihan_2, penalty: 5 },
          { data: selection.pilihan_3, penalty: 10 },
          { data: selection.pilihan_4, penalty: 15 }
        ];

        for (let i = 0; i < choices.length; i++) {
          const choice = choices[i].data;
          const penalty = choices[i].penalty;
          
          if (choice) {
            // Gunakan rata_rata_nilai_masuk dari DB, jika null fallback ke 600
            const basePg = choice.rata_rata_nilai_masuk || 600; 
            const requiredPg = basePg + penalty;
            
            if (averageScore >= requiredPg) {
              status = 'PASSED';
              acceptedProgram = choice;
              acceptedChoiceIndex = i + 1;
              break;
            }
          }
        }
      }

      setData({ profile, result, status, acceptedProgram, acceptedChoiceIndex });
      setLoading(false);
    }
    fetchData();
  }, [id, router]);

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'white' }}>
        <h2>Memuat Hasil...</h2>
      </div>
    );
  }

  if (data?.status === 'NOT_TAKEN') {
    return (
      <div className="container" id="not-accepted">
        <div className="box">
          <div className="card">
            <div className="row">
              <div className="col-12 col-sm-5 d-sm-block">
                <img src="/logo.png" className="img-fluid header-img" alt="Logo Daily Study" style={{ maxHeight: '80px', objectFit: 'contain' }} />
              </div>
            </div>
            <br />
            <div className="row">
              <div className="col text-center">
                <span className="title" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>PENGUMUMAN HASIL TRYOUT SNBT DAILY STUDY 2027</span>
              </div>
            </div>
            <div className="card-body">
              <p className="text-center" style={{ fontSize: '1em' }}>
                DATA HASIL UJIAN TIDAK DITEMUKAN UNTUK PESERTA <strong>{data.profile.nomor_peserta_utbk}</strong>.
              </p>
              <p className="text-center" style={{ fontWeight: 'bold', fontSize: '1.2em' }}>PESERTA BELUM MENYELESAIKAN TRYOUT.</p>
            </div>
            <div className="row">
              <div className="col-12">
                <Link id="not-accepted-back" className="btn btn-block btn-success" href="/pengumuman">Kembali ke pencarian</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPassed = data.status === 'PASSED';

  if (isPassed) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#77b2c5', background: 'linear-gradient(to bottom, #77b2c5, #77b2c5)', padding: '20px', fontFamily: 'sans-serif', color: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '20px' }}>
            <img src="/logo.png" alt="Logo SNPMB" style={{ height: '70px', objectFit: 'contain' }} />
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: 0 }}>PENGUMUMAN HASIL SELEKSI SNBT DAILY STUDY 2027</h1>
          </div>

          {/* Content Layout */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', justifyContent: 'center' }}>
            
            {/* Left: QR Code */}
            <div style={{ flex: '1 1 350px', maxWidth: '400px' }}>
              <div style={{ backgroundColor: 'white', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img src="/images_snbt/qr.png" alt="QR Code" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>

            {/* Right: Info */}
            <div style={{ flex: '2 1 450px', fontSize: '1rem', lineHeight: '1.5' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 20px 1fr', marginBottom: '20px' }}>
                <div>Nomor peserta</div><div>:</div><div style={{ fontWeight: 'bold' }}>{data.profile.nomor_peserta_utbk}</div>
                <div>Nama</div><div>:</div><div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{data.profile.nama}</div>
                <div>Tanggal lahir</div><div>:</div><div style={{ fontWeight: 'bold' }}>{new Date(data.profile.tanggal_lahir).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, ' - ')}</div>
              </div>

              <div style={{ fontWeight: 'bold', marginBottom: '20px' }}>
                Selamat! Anda dinyatakan lulus seleksi Tryout SNBT 2027 di
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 20px 1fr', marginBottom: '20px' }}>
                <div>PTN</div><div>:</div><div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{data.acceptedProgram?.university?.kode_universitas} - {data.acceptedProgram?.university?.nama_universitas}</div>
                <div>Program Studi</div><div>:</div><div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{data.acceptedProgram?.kode_prodi} - {data.acceptedProgram?.nama_prodi} ({data.acceptedProgram?.jenis})</div>
                <div>Diterima Pada</div><div>:</div><div style={{ fontWeight: 'bold', color: '#00ff88' }}>PILIHAN {data.acceptedChoiceIndex}</div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                Persyaratan pendaftaran ulang calon mahasiswa baru dapat dilihat di <a href="#" style={{ color: '#00d2ff', textDecoration: 'none' }}>sini</a>.
              </div>

              <div style={{ marginBottom: '20px' }}>
                Anda dapat mencetak kembali Kartu Tanda Peserta UTBK-SNBT 2027 di <Link href="/dashboard" style={{ color: '#00d2ff', textDecoration: 'none' }}>sini</Link>.
              </div>

              <div>
                <Link href="/dashboard" style={{ 
                  display: 'block', 
                  backgroundColor: '#40a7a3', 
                  color: 'white', 
                  textAlign: 'center', 
                  padding: '12px', 
                  textDecoration: 'none', 
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '2px'
                }}>
                  UNDUH PENGUMUMAN KETUA SNPMB (PDF)
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Button */}
          <div style={{ marginTop: '30px' }}>
            <Link href="/pengumuman" style={{
              display: 'block',
              backgroundColor: '#28a745',
              color: 'white',
              textAlign: 'center',
              padding: '12px',
              textDecoration: 'none',
              fontWeight: 'bold',
              borderRadius: '2px'
            }}>
              Kembali ke pencarian
            </Link>
          </div>

        </div>
      </div>
    );
  }

  // Failed View
  return (
    <div className="container" id="not-accepted">
      <div className="box">
        <div className="card">
          <div className="row">
            <div className="col-12 col-sm-5 d-sm-block">
              <img src="/logo.png" className="img-fluid header-img" alt="Logo Daily Study" style={{ maxHeight: '80px', objectFit: 'contain' }} />
            </div>
          </div>
          <br />
          <div className="row">
            <div className="col text-center">
              <span className="title" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>PENGUMUMAN HASIL TRYOUT SNBT DAILY STUDY 2027</span>
            </div>
          </div>
          <div className="card-body">
            <p className="text-center" style={{ fontSize: '1em' }}>
              PESERTA ATAS NAMA <strong>{data.profile.nama}</strong> DENGAN NOMOR PESERTA <strong>{data.profile.nomor_peserta_utbk}</strong> DINYATAKAN <strong>TIDAK LULUS</strong> SELEKSI TRYOUT SNBT 2027.
            </p>
            <p className="text-center" style={{ fontWeight: 'bold', fontSize: '1.5em', color: 'white' }}>JANGAN PUTUS ASA DAN TETAP SEMANGAT!</p>
          </div>
          <div className="row mt-4">
            <div className="col-12">
              <Link id="not-accepted-back" className="btn btn-block btn-success" href="/pengumuman">Kembali ke pencarian</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PengumumanHasilPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', color: 'white' }}><h2>Memuat...</h2></div>}>
      <PengumumanHasilContent />
    </Suspense>
  );
}
