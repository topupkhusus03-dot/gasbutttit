const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/auto-import-data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(rawData);

console.log('Current universities count:', data.universities.length);
console.log('Current programs count:', data.programs.length);

// Standar program studi umum UTBK SNBT Saintek & Soshum & Vokasi
const standardSaintek = [
  { nama: 'PENDIDIKAN DOKTER / KEDOKTERAN', daya_tampung: 50 },
  { nama: 'PENDIDIKAN DOKTER GIGI', daya_tampung: 40 },
  { nama: 'FARMASI', daya_tampung: 60 },
  { nama: 'ILMU KEPERAWATAN', daya_tampung: 70 },
  { nama: 'KESEHATAN MASYARAKAT', daya_tampung: 80 },
  { nama: 'ILMU GIZI', daya_tampung: 45 },
  { nama: 'TEKNIK INFORMATIKA / ILMU KOMPUTER', daya_tampung: 90 },
  { nama: 'SISTEM INFORMASI', daya_tampung: 75 },
  { nama: 'TEKNIK SIPIL', daya_tampung: 80 },
  { nama: 'TEKNIK ELEKTRO', daya_tampung: 75 },
  { nama: 'TEKNIK MESIN', daya_tampung: 70 },
  { nama: 'TEKNIK INDUSTRI', daya_tampung: 80 },
  { nama: 'TEKNIK KIMIA', daya_tampung: 55 },
  { nama: 'TEKNIK LINGKUNGAN', daya_tampung: 50 },
  { nama: 'ARSITEKTUR', daya_tampung: 50 },
  { nama: 'MATEMATIKA', daya_tampung: 60 },
  { nama: 'STATISTIKA / SAINS DATA', daya_tampung: 50 },
  { nama: 'FISIKA', daya_tampung: 50 },
  { nama: 'KIMIA', daya_tampung: 55 },
  { nama: 'BIOLOGI', daya_tampung: 60 },
  { nama: 'AGROTEKNOLOGI / AGRIBISNIS', daya_tampung: 100 },
  { nama: 'PETERNAKAN', daya_tampung: 90 },
  { nama: 'ILMU KELAUTAN / PERIKANAN', daya_tampung: 70 },
  { nama: 'KEHUTANAN', daya_tampung: 65 }
];

const standardSoshum = [
  { nama: 'ILMU HUKUM', daya_tampung: 180 },
  { nama: 'MANAJEMEN', daya_tampung: 140 },
  { nama: 'AKUNTANSI', daya_tampung: 130 },
  { nama: 'ILMU EKONOMI / EKONOMI PEMBANGUNAN', daya_tampung: 90 },
  { nama: 'PSIKOLOGI', daya_tampung: 100 },
  { nama: 'ILMU KOMUNIKASI', daya_tampung: 95 },
  { nama: 'HUBUNGAN INTERNASIONAL', daya_tampung: 60 },
  { nama: 'ILMU ADMINISTRASI NEGARA / PUBLIK', daya_tampung: 85 },
  { nama: 'ILMU ADMINISTRASI NIAGA / BISNIS', daya_tampung: 85 },
  { nama: 'ILMU POLITIK', daya_tampung: 60 },
  { nama: 'SOSIOLOGI', daya_tampung: 65 },
  { nama: 'SASTRA INGGRIS', daya_tampung: 60 },
  { nama: 'SASTRA INDONESIA', daya_tampung: 60 },
  { nama: 'PENDIDIKAN GURU SEKOLAH DASAR (PGSD)', daya_tampung: 100 },
  { nama: 'PENDIDIKAN BAHASA DAN SASTRA INDONESIA', daya_tampung: 70 },
  { nama: 'PENDIDIKAN BAHASA INGGRIS', daya_tampung: 70 },
  { nama: 'PENDIDIKAN MATEMATIKA', daya_tampung: 65 }
];

const standardVokasi = [
  { nama: 'D4 TEKNOLOGI REKAYASA PERANGKAT LUNAK', daya_tampung: 40 },
  { nama: 'D4 AKUNTANSI SEKTOR PUBLIK', daya_tampung: 50 },
  { nama: 'D4 MANAJEMEN BISNIS TERAPAN', daya_tampung: 50 },
  { nama: 'D4 TEKNIK OTOMATISASI DAN ROBOTIKA', daya_tampung: 35 },
  { nama: 'D3 TEKNIK INFORMATIKA', daya_tampung: 45 },
  { nama: 'D3 PERPAJAKAN', daya_tampung: 60 },
  { nama: 'D3 KEUANGAN DAN PERBANKAN', daya_tampung: 60 }
];

const existingProgramsByUniv = {};
for (const p of data.programs) {
  if (!existingProgramsByUniv[p.kode_universitas]) {
    existingProgramsByUniv[p.kode_universitas] = [];
  }
  existingProgramsByUniv[p.kode_universitas].push(p);
}

const allGeneratedPrograms = [];

for (const univ of data.universities) {
  const kUniv = univ.kode_universitas;
  const existing = existingProgramsByUniv[kUniv] || [];
  
  if (existing.length >= 20) {
    // Already rich (like UI, ITB, etc.)
    allGeneratedPrograms.push(...existing);
  } else {
    // Generate complete list for this PTN
    const existingNames = new Set(existing.map(p => p.nama_prodi.toUpperCase()));
    allGeneratedPrograms.push(...existing);

    let idx = existing.length + 1;

    // Tambahkan prodi Saintek
    for (const st of standardSaintek) {
      if (!existingNames.has(st.nama)) {
        allGeneratedPrograms.push({
          kode_universitas: kUniv,
          nama_prodi: st.nama,
          kode_prodi: `${kUniv}-${idx++}`,
          jenis: 'Sarjana',
          daya_tampung: st.daya_tampung
        });
      }
    }

    // Tambahkan prodi Soshum
    for (const sh of standardSoshum) {
      if (!existingNames.has(sh.nama)) {
        allGeneratedPrograms.push({
          kode_universitas: kUniv,
          nama_prodi: sh.nama,
          kode_prodi: `${kUniv}-${idx++}`,
          jenis: 'Sarjana',
          daya_tampung: sh.daya_tampung
        });
      }
    }

    // Tambahkan prodi Vokasi (D4/D3)
    for (const vk of standardVokasi) {
      if (!existingNames.has(vk.nama)) {
        allGeneratedPrograms.push({
          kode_universitas: kUniv,
          nama_prodi: vk.nama,
          kode_prodi: `${kUniv}-${idx++}`,
          jenis: vk.nama.startsWith('D4') ? 'D4' : 'D3',
          daya_tampung: vk.daya_tampung
        });
      }
    }
  }
}

console.log('New total programs count:', allGeneratedPrograms.length);

const finalData = {
  universities: data.universities,
  programs: allGeneratedPrograms
};

fs.writeFileSync(dataPath, JSON.stringify(finalData, null, 2));
console.log('auto-import-data.json updated successfully!');
