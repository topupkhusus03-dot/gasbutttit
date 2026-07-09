'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function PengumumanPage() {
  const [nomor, setNomor] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const router = useRouter();

  const [deadlineStr, setDeadlineStr] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    async function fetchDeadline() {
      const supabase = createClient();
      const { data } = await supabase.from('global_settings').select('value').eq('key', 'snbt_announcement_time').maybeSingle();
      
      let targetTime = 0;
      let dateString = '';
      if (data && data.value) {
        targetTime = new Date(data.value).getTime();
        dateString = new Date(data.value).toString();
      } else {
        // Fallback to 1 hour if not set
        targetTime = Date.now() + 3600000;
        dateString = new Date(targetTime).toString();
      }
      
      setDeadlineStr(dateString);
      
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, targetTime - now);
        setTimeLeft(diff);
        if (diff === 0) {
          clearInterval(interval);
        }
      }, 1000);
    }
    
    fetchDeadline();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!nomor || !day || !month || !year) {
      setError('Mohon lengkapi Nomor Peserta dan Tanggal Lahir.');
      return;
    }
    if (!checked) {
      setError('Mohon centang pernyataan persetujuan.');
      return;
    }

    setLoading(true);
    setError('');

    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const supabase = createClient();

    let cleanNomor = nomor.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanNomor.length === 12) {
      cleanNomor = `${cleanNomor.substring(0, 2)}-${cleanNomor.substring(2, 6)}-${cleanNomor.substring(6, 12)}`;
    }

    const { data, error: dbErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('nomor_peserta_utbk', cleanNomor)
      .eq('tanggal_lahir', formattedDate)
      .maybeSingle();

    setLoading(false);

    if (dbErr) {
      setError('Terjadi kesalahan pada sistem. Silakan coba lagi.');
      return;
    }

    if (!data) {
      setError('Nomor peserta atau tanggal lahir tidak sesuai/tidak ditemukan.');
      return;
    }

    router.push(`/pengumuman/hasil?id=${data.id}`);
  }

  // Loading state while mounting to prevent hydration mismatch
  if (timeLeft === null) return null;

  if (timeLeft > 0) {
    const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const h = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const m = Math.floor((timeLeft / 1000 / 60) % 60);
    const s = Math.floor((timeLeft / 1000) % 60);

    return (
      <div className="container" id="countdown-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#97aabf', padding: '50px', width: '100%', maxWidth: '750px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <img src="/logo.png" alt="Logo SNPMB" style={{ maxHeight: '70px', objectFit: 'contain', marginBottom: '30px' }} />
          
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '40px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            PENGUMUMAN HASIL TRYOUT SNBT 2027
          </h2>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', color: '#ffffff', marginBottom: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '300', marginBottom: '5px' }}>{d}</div>
              <div style={{ fontSize: '0.85rem' }}>Hari</div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '300', alignSelf: 'flex-start' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '300', marginBottom: '5px' }}>{h.toString().padStart(2, '0')}</div>
              <div style={{ fontSize: '0.85rem' }}>Jam</div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '300', alignSelf: 'flex-start' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '300', marginBottom: '5px' }}>{m.toString().padStart(2, '0')}</div>
              <div style={{ fontSize: '0.85rem' }}>Menit</div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '300', alignSelf: 'flex-start' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '300', marginBottom: '5px' }}>{s.toString().padStart(2, '0')}</div>
              <div style={{ fontSize: '0.85rem' }}>Detik</div>
            </div>
          </div>
          
          <p style={{ color: '#ffffff', fontSize: '0.85rem', marginTop: '20px' }}>
            {deadlineStr}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" id="main">	
      <div className="box">
        <div className="card">
          <div className="row">
            <div className="col-12 col-sm-5 d-sm-block">
              <img src="/logo.png" className="img-fluid header-img" alt="Logo Daily Study" style={{ maxHeight: '80px', objectFit: 'contain' }} />
            </div>
          </div>
          <br />
          <div className="row">
            <div className="col">
              <span className="title" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>PENGUMUMAN HASIL TRYOUT SNBT DAILY STUDY 2027</span>
            </div>
          </div>
          <br />
          <div className="row">
            <div className="col">
              <p style={{ color: 'white' }}>Masukkan nomor peserta Tryout SNBT dan tanggal lahir Anda.</p>
            </div>
          </div>

          {error && (
            <div className="row mx-auto m-1">
              <div className="col text-center">
                <div className="error" style={{ color: 'red', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
                  {error}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSearch} className="row">
            <div className="col">
              <div className="form-group">
                <label htmlFor="nopes">Nomor peserta UTBK-SNBT</label>
                <input 
                  type="text" 
                  id="nopes" 
                  className="form-control no-spinners" 
                  tabIndex={1} 
                  size={12} 
                  autoComplete="off"
                  value={nomor}
                  onChange={(e) => setNomor(e.target.value)}
                />
                <small id="nopes-help" className="form-text">Masukkan 12-digit nomor peserta UTBK-SNBT Anda.</small>
              </div>
              <div className="form-group">
                <label>Tanggal lahir</label>
                <div className="form-row">
                  <div className="col">
                    <input type="text" id="day" className="form-control no-spinners" tabIndex={2} maxLength={2} size={2} autoComplete="off" placeholder="dd" value={day} onChange={(e) => setDay(e.target.value)} />
                    <small id="day-help" className="form-text">Tanggal (2 digit): 01-31</small>
                  </div>
                  <div className="col">
                    <input type="text" id="month" className="form-control no-spinners" tabIndex={3} maxLength={2} size={2} autoComplete="off" placeholder="mm" value={month} onChange={(e) => setMonth(e.target.value)} />
                    <small id="month-help" className="form-text">Bulan (2 digit): 01-12</small>
                  </div>
                  <div className="col">
                    <input type="text" id="year" className="form-control no-spinners" tabIndex={4} maxLength={4} size={4} autoComplete="off" placeholder="yyyy" value={year} onChange={(e) => setYear(e.target.value)} />
                    <small id="year-help" className="form-text">Tahun (4 digit)</small>
                  </div>
                </div>
              </div>
              <div className="form-check">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="statement" 
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="statement">
                  <p className="small">Dengan ini saya menyatakan bahwa apabila di kemudian hari ditemukan kecurangan yang saya lakukan dalam UTBK-SNBT 2026, maka status penerimaan saya dibatalkan.</p>
                </label>
              </div>
              <button id="search" className="btn btn-primary mt-2" type="submit" disabled={loading}>
                {loading ? 'Memeriksa...' : 'Lihat Hasil'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
