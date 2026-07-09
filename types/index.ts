export type Role = 'admin' | 'user';

export type ExamStatus = 'pending' | 'ongoing' | 'completed';

export type SubtestGroup = 'TPS' | 'Literasi';

export type ProgramType = 'Sarjana' | 'D4' | 'D3';

export type UniversityType = 'PTN Akademik' | 'PTN Vokasi';

export interface User {
  id: string;
  email: string;
  nama: string;
  nisn: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  asal_sekolah: string;
  npsn: string;
  nomor_peserta_utbk: string;
  foto_url: string | null;
  role: Role;
  created_at: string;
}

export interface Subtest {
  id: string;
  nama: string;
  kode: string;
  durasi_menit: number;
  jumlah_soal: number;
  kelompok: SubtestGroup;
  urutan: number;
}

export interface Question {
  id: string;
  subtest_id: string;
  nomor: number;
  konten: string;
  gambar_url: string | null;
  pilihan_a: string;
  pilihan_b: string;
  pilihan_c: string;
  pilihan_d: string;
  pilihan_e: string | null;
  kunci_jawaban: string;
  parameter_a: number;
  parameter_b: number;
  parameter_c: number;
  created_at: string;
}

export interface ExamSession {
  id: string;
  user_id: string;
  status: ExamStatus;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  tanggal_tes: string;
  pelanggaran: number;
}

export interface Answer {
  id: string;
  session_id: string;
  question_id: string;
  jawaban_user: string | null;
  benar: boolean | null;
}

export interface ExamResult {
  id: string;
  user_id: string;
  session_id: string;
  skor_penalaran_umum: number;
  skor_ppu: number;
  skor_pbm: number;
  skor_pk: number;
  skor_literasi_id: number;
  skor_literasi_id_saintek: number;
  skor_literasi_id_soshum: number;
  skor_literasi_en: number;
  skor_penalaran_matematika: number;
  theta_penalaran_umum: number;
  theta_ppu: number;
  theta_pbm: number;
  theta_pk: number;
  theta_literasi_id: number;
  theta_literasi_en: number;
  theta_penalaran_matematika: number;
  tanggal_selesai: string;
}

export interface University {
  id: string;
  nama_universitas: string;
  kode_universitas: string;
  jenis: UniversityType;
  provinsi: string;
}

export interface StudyProgram {
  id: string;
  university_id: string;
  nama_prodi: string;
  kode_prodi: string;
  jenis: ProgramType;
  daya_tampung: number;
  rata_rata_nilai_masuk: number | null;
  university?: University;
}

export interface ProgramSelection {
  id: string;
  user_id: string;
  pilihan_1: string | null;
  pilihan_2: string | null;
  pilihan_3: string | null;
  pilihan_4: string | null;
}

export interface IRTParameters {
  a: number;
  b: number;
  c: number;
}

export interface SubtestScore {
  kode: string;
  nama: string;
  skor: number;
  theta: number;
}

export interface CertificateData {
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  nisn: string;
  asal_sekolah: string;
  npsn: string;
  nomor_peserta_utbk: string;
  foto_url: string | null;
  tanggal_tes: string;
  hasil: ExamResult;
}
