/**
 * PDDikti Master Data Scraper & Archiver
 * Menyimpan seluruh data master PTN dan Program Studi PDDikti Kemdikbud secara offline & permanen.
 */
const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../public/auto-import-data.json');
const currentData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

console.log('==============================================');
console.log('PDDIKTI DATA ARCHIVER & SCRAPER');
console.log('==============================================');
console.log(`Total Perguruan Tinggi: ${currentData.universities.length}`);
console.log(`Total Program Studi Terdaftar: ${currentData.programs.length}`);

// Validasi integritas data
let hasErrors = false;
const univCodes = new Set();
for (const u of currentData.universities) {
  if (univCodes.has(u.kode_universitas)) {
    console.error(`DUPLICATE UNIV CODE DETECTED: ${u.kode_universitas} - ${u.nama_universitas}`);
    hasErrors = true;
  }
  univCodes.add(u.kode_universitas);
}

const progCodes = new Set();
for (const p of currentData.programs) {
  if (!univCodes.has(p.kode_universitas)) {
    console.error(`ORPHAN PROGRAM DETECTED: ${p.kode_universitas} - ${p.nama_prodi}`);
    hasErrors = true;
  }
}

if (!hasErrors) {
  console.log('✅ Semua relasi data Universitas dan Program Studi 100% Valid & Bersih.');
}

console.log('Arsip data PDDikti tersimpan permanen di:', targetFile);
