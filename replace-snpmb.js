const fs = require('fs');

function repl(file, search, replace) {
  let text = fs.readFileSync(file, 'utf-8');
  let newText = text.split(search).join(replace);
  if (text !== newText) {
    fs.writeFileSync(file, newText, 'utf-8');
    console.log('Updated ' + file);
  }
}

repl('app/page.tsx', 'TryoutSNBT bukan bagian resmi dari SNPMB. Platform ini dibuat untuk keperluan latihan.', 'TryoutSNBT bukan bagian resmi dari instansi pemerintah mana pun. Platform ini dibuat untuk keperluan latihan mandiri.');

repl('app/pengumuman/page.tsx', 'alt="Logo SNPMB"', 'alt="Logo Daily Study"');
repl('app/pengumuman/hasil/page.tsx', 'alt="Logo SNPMB"', 'alt="Logo Daily Study"');
repl('app/pengumuman/hasil/page.tsx', 'UNDUH PENGUMUMAN KETUA SNPMB (PDF)', 'UNDUH HASIL TRYOUT (PDF)');

repl('app/seb/page.tsx', '<strong>SNPMB</strong>', '<strong>DAILY STUDY</strong>');
repl('app/seb/page.tsx', '<div>Seleksi Nasional Penerimaan Mahasiswa Baru</div>', '<div>Tryout UTBK SNBT 2027</div>');

repl('app/certificate/page.tsx', 'penerimaan mahasiswa baru', 'evaluasi tryout');
