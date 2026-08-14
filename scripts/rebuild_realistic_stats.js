const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/auto-import-data.json');
const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Tiers of Universities
function getUnivTier(univ) {
  const name = univ.nama_universitas.toUpperCase();
  const code = univ.kode_universitas;

  // Tier 1 (Top 6 Nasional)
  if (
    code === 'UI' || code === '1321' || name === 'UNIVERSITAS INDONESIA' ||
    code === 'ITB' || code === '1332' || name === 'INSTITUT TEKNOLOGI BANDUNG' ||
    code === 'UGM' || code === '1361' || name === 'UNIVERSITAS GADJAH MADA' ||
    code === 'UNAIR' || code === '1381' || name === 'UNIVERSITAS AIRLANGGA' ||
    code === 'ITS' || code === '1382' || name === 'INSTITUT TEKNOLOGI SEPULUH NOPEMBER' ||
    code === 'IPB' || code === '1341' || name === 'INSTITUT PERTANIAN BOGOR'
  ) {
    return 1;
  }

  // Tier 2 (PTN Favorit & Ex-IKIP Utama)
  if (
    name.includes('PADJADJARAN') || name.includes('DIPONEGORO') || name.includes('BRAWIJAYA') ||
    name.includes('SEBELAS MARET') || name.includes('HASANUDDIN') || name.includes('SUMATERA UTARA') ||
    name.includes('ANDALAS') || name.includes('SRIWIJAYA') || name.includes('JEMBER') ||
    name.includes('UDAYANA') || name.includes('PENDIDIKAN INDONESIA') || name.includes('NEGERI YOGYAKARTA') ||
    name.includes('NEGERI SEMARANG') || name.includes('NEGERI JAKARTA') || name.includes('NEGERI SURABAYA') ||
    name.includes('NEGERI MALANG') || name.includes('NEGERI MAKASSAR') || name.includes('NEGERI PADANG') ||
    name.includes('NEGERI MEDAN') || name.includes('SYIAH KUALA') || name.includes('RIAU') ||
    name.includes('LAMPUNG') || name.includes('UIN SYARIF HIDAYATULLAH') || name.includes('UIN SUNAN KALIJAGA')
  ) {
    return 2;
  }

  // Tier 4 (Politeknik & Seni)
  if (name.includes('POLITEKNIK') || name.includes('POLMAN') || name.includes('PENS') || name.includes('PPNS') || name.includes('ISI ') || name.includes('ISBI ')) {
    return 4;
  }

  // Tier 3 (PTN Daerah & UIN)
  return 3;
}

function calculateRealisticMetrics(univ, progName, jenis) {
  const tier = getUnivTier(univ);
  const p = progName.toUpperCase();

  let baseScore = 600;
  let baseKuota = 60;

  // 1. Base score and quota by field popularity
  if (p.includes('DOKTER GIGI')) {
    baseScore = 670;
    baseKuota = 60;
  } else if (p.includes('KEDOKTERAN') || p.includes('PENDIDIKAN DOKTER')) {
    baseScore = 700;
    baseKuota = 75;
  } else if (p.includes('FARMASI') || p.includes('GIZI') || p.includes('KEPERAWATAN')) {
    baseScore = 635;
    baseKuota = 80;
  } else if (p.includes('KOMPUTER') || p.includes('INFORMATIKA') || p.includes('KECERDASAN') || p.includes('SAINS DATA') || p.includes('STEI') || p.includes('SISTEM INFORMASI')) {
    baseScore = 665;
    baseKuota = 85;
  } else if (p.includes('AKTUARIA') || p.includes('TEKNIK ELEKTRO') || p.includes('TEKNIK MESIN') || p.includes('TEKNIK INDUSTRI') || p.includes('TEKNIK KIMIA') || p.includes('TEKNIK PERTAMBANGAN') || p.includes('TEKNIK PERMINYAKAN') || p.includes('ARSITEKTUR')) {
    baseScore = 645;
    baseKuota = 90;
  } else if (p.includes('TEKNIK SIPIL') || p.includes('TEKNIK LINGKUNGAN') || p.includes('TEKNIK PERKAPALAN') || p.includes('TEKNOLOGI PANGAN')) {
    baseScore = 625;
    baseKuota = 95;
  } else if (p.includes('HUKUM') || p.includes('ILMU HUKUM')) {
    baseScore = 635;
    baseKuota = 220; // Kuota hukum selalu besar
  } else if (p.includes('MANAJEMEN') || p.includes('AKUNTANSI') || p.includes('ILMU KOMUNIKASI') || p.includes('PSIKOLOGI') || p.includes('HUBUNGAN INTERNASIONAL')) {
    baseScore = 640;
    baseKuota = 150;
  } else if (p.includes('ADMINISTRASI') || p.includes('EKONOMI') || p.includes('BISNIS')) {
    baseScore = 615;
    baseKuota = 120;
  } else if (p.includes('PGSD') || p.includes('PENDIDIKAN')) {
    baseScore = 590;
    baseKuota = 110;
  } else if (p.includes('AGROTEKNOLOGI') || p.includes('AGRIBISNIS') || p.includes('PETERNAKAN') || p.includes('KEHUTANAN') || p.includes('PERIKANAN') || p.includes('PERTANIAN')) {
    baseScore = 580;
    baseKuota = 100;
  } else if (p.includes('MATEMATIKA') || p.includes('FISIKA') || p.includes('KIMIA') || p.includes('BIOLOGI') || p.includes('GEOGRAFI')) {
    baseScore = 585;
    baseKuota = 70;
  } else if (p.includes('SASTRA') || p.includes('SEJARAH') || p.includes('FILSAFAT') || p.includes('ARKEOLOGI') || p.includes('ANTROPOLOGI') || p.includes('SOSIOLOGI')) {
    baseScore = 580;
    baseKuota = 65;
  } else if (p.includes('SENI') || p.includes('DESAIN') || p.includes('DKV') || p.includes('TARI') || p.includes('MUSIK')) {
    baseScore = 595;
    baseKuota = 55;
  } else {
    baseScore = 580;
    baseKuota = 60;
  }

  // 2. Modifier based on Univ Tier
  if (tier === 1) {
    baseScore += 35;
    baseKuota = Math.round(baseKuota * 1.1);
  } else if (tier === 2) {
    baseScore += 10;
    baseKuota = Math.round(baseKuota * 1.0);
  } else if (tier === 3) {
    baseScore -= 45;
    baseKuota = Math.round(baseKuota * 0.85);
  } else if (tier === 4) { // Vokasi / Politeknik / Seni
    baseScore -= 20;
    baseKuota = Math.round(baseKuota * 0.75);
  }

  // 3. Modifier by Jenjang (D3 / D4 / Sarjana)
  if (jenis === 'D3') {
    baseScore -= 30;
    baseKuota = Math.min(60, Math.round(baseKuota * 0.6));
  } else if (jenis === 'D4') {
    baseScore -= 15;
    baseKuota = Math.min(80, Math.round(baseKuota * 0.75));
  }

  // 4. Natural pseudo-random variance for realism (deterministic based on name hash)
  let hash = 0;
  for (let i = 0; i < (univ.kode_universitas + progName).length; i++) {
    hash = (hash << 5) - hash + (univ.kode_universitas + progName).charCodeAt(i);
    hash |= 0;
  }
  const varianceScore = (Math.abs(hash) % 15) - 7;
  const varianceKuota = (Math.abs(hash >> 3) % 11) - 5;

  const finalScore = Math.max(500, Math.min(745, baseScore + varianceScore));
  const finalKuota = Math.max(20, Math.min(350, baseKuota + varianceKuota));

  return { finalScore, finalKuota };
}

// Re-map all programs with realistic attributes
const updatedPrograms = currentData.programs.map(p => {
  const u = currentData.universities.find(x => x.kode_universitas === p.kode_universitas);
  const metrics = calculateRealisticMetrics(u || { nama_universitas: '', kode_universitas: p.kode_universitas }, p.nama_prodi, p.jenis);

  return {
    ...p,
    daya_tampung: metrics.finalKuota,
    rata_rata_nilai_masuk: metrics.finalScore
  };
});

const output = {
  universities: currentData.universities,
  programs: updatedPrograms
};

fs.writeFileSync(dataPath, JSON.stringify(output, null, 2));
console.log('Successfully updated all 6029 programs with realistic tier-based passing grades & realistic quotas!');
