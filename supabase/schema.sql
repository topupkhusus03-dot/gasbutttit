-- ============================================================
-- SNBT Tryout Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  nama text not null,
  nisn text unique,
  tempat_lahir text,
  tanggal_lahir date,
  asal_sekolah text,
  npsn text,
  nomor_peserta_utbk text unique,
  foto_url text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admin can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admin can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Allow insert on register"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- SUBTESTS
-- ============================================================
create table public.subtests (
  id uuid default uuid_generate_v4() primary key,
  nama text not null,
  kode text not null unique,
  durasi_menit integer not null,
  jumlah_soal integer not null,
  kelompok text not null check (kelompok in ('TPS', 'Literasi')),
  urutan integer not null unique
);

alter table public.subtests enable row level security;

create policy "Anyone can read subtests"
  on public.subtests for select
  using (true);

create policy "Admin can manage subtests"
  on public.subtests for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

insert into public.subtests (nama, kode, durasi_menit, jumlah_soal, kelompok, urutan) values
  ('Penalaran Umum', 'PU', 30, 30, 'TPS', 1),
  ('Pengetahuan dan Pemahaman Umum', 'PPU', 15, 20, 'TPS', 2),
  ('Pemahaman Bacaan dan Menulis', 'PBM', 25, 20, 'TPS', 3),
  ('Pengetahuan Kuantitatif', 'PK', 20, 20, 'TPS', 4),
  ('Literasi dalam Bahasa Indonesia', 'LBI', 42, 30, 'Literasi', 5),
  ('Literasi dalam Bahasa Inggris', 'LIE', 20, 20, 'Literasi', 6),
  ('Penalaran Matematika', 'PM', 42, 20, 'Literasi', 7);

-- ============================================================
-- QUESTIONS
-- ============================================================
create table public.questions (
  id uuid default uuid_generate_v4() primary key,
  subtest_id uuid references public.subtests(id) on delete cascade not null,
  nomor integer not null,
  konten text not null,
  gambar_url text,
  pilihan_a text not null,
  pilihan_b text not null,
  pilihan_c text not null,
  pilihan_d text not null,
  pilihan_e text,
  kunci_jawaban text not null,
  parameter_a numeric(5,3) not null default 1.0,
  parameter_b numeric(5,3) not null default 0.0,
  parameter_c numeric(5,3) not null default 0.25,
  created_at timestamptz default now(),
  unique(subtest_id, nomor)
);

alter table public.questions enable row level security;

create policy "Authenticated users can read questions during exam"
  on public.questions for select
  using (auth.uid() is not null);

create policy "Admin can manage questions"
  on public.questions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- EXAM SESSIONS
-- ============================================================
create table public.exam_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'ongoing', 'completed')),
  waktu_mulai timestamptz,
  waktu_selesai timestamptz,
  tanggal_tes date not null default current_date,
  pelanggaran integer not null default 0,
  created_at timestamptz default now()
);

alter table public.exam_sessions enable row level security;

create policy "Users can view own sessions"
  on public.exam_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own session"
  on public.exam_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own session"
  on public.exam_sessions for update
  using (auth.uid() = user_id);

create policy "Admin can view all sessions"
  on public.exam_sessions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- ANSWERS
-- ============================================================
create table public.answers (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.exam_sessions(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  jawaban_user text check (jawaban_user in ('A', 'B', 'C', 'D', 'E')),
  benar boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(session_id, question_id)
);

alter table public.answers enable row level security;

create policy "Users can manage own answers"
  on public.answers for all
  using (
    exists (
      select 1 from public.exam_sessions es
      where es.id = session_id and es.user_id = auth.uid()
    )
  );

create policy "Admin can view all answers"
  on public.answers for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- EXAM RESULTS
-- ============================================================
create table public.exam_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id uuid references public.exam_sessions(id) on delete cascade not null unique,
  skor_penalaran_umum numeric(6,2),
  skor_ppu numeric(6,2),
  skor_pbm numeric(6,2),
  skor_pk numeric(6,2),
  skor_literasi_id numeric(6,2),
  skor_literasi_id_saintek numeric(6,2),
  skor_literasi_id_soshum numeric(6,2),
  skor_literasi_en numeric(6,2),
  skor_penalaran_matematika numeric(6,2),
  theta_penalaran_umum numeric(6,4),
  theta_ppu numeric(6,4),
  theta_pbm numeric(6,4),
  theta_pk numeric(6,4),
  theta_literasi_id numeric(6,4),
  theta_literasi_en numeric(6,4),
  theta_penalaran_matematika numeric(6,4),
  tanggal_selesai timestamptz default now()
);

alter table public.exam_results enable row level security;

create policy "Users can view own results"
  on public.exam_results for select
  using (auth.uid() = user_id);

create policy "System can insert results"
  on public.exam_results for insert
  with check (auth.uid() = user_id);

create policy "Admin can view all results"
  on public.exam_results for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- UNIVERSITIES
-- ============================================================
create table public.universities (
  id uuid default uuid_generate_v4() primary key,
  nama_universitas text not null,
  kode_universitas text unique,
  jenis text not null check (jenis in ('PTN Akademik', 'PTN Vokasi')),
  provinsi text,
  created_at timestamptz default now()
);

alter table public.universities enable row level security;

create policy "Anyone can read universities"
  on public.universities for select
  using (true);

create policy "Admin can manage universities"
  on public.universities for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- STUDY PROGRAMS
-- ============================================================
create table public.study_programs (
  id uuid default uuid_generate_v4() primary key,
  university_id uuid references public.universities(id) on delete cascade not null,
  nama_prodi text not null,
  kode_prodi text,
  jenis text not null check (jenis in ('Sarjana', 'D4', 'D3')),
  daya_tampung integer not null default 0,
  rata_rata_nilai_masuk numeric(6,2),
  created_at timestamptz default now()
);

alter table public.study_programs enable row level security;

create policy "Anyone can read study programs"
  on public.study_programs for select
  using (true);

create policy "Admin can manage study programs"
  on public.study_programs for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- PROGRAM SELECTIONS
-- ============================================================
create table public.program_selections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  pilihan_1 uuid references public.study_programs(id),
  pilihan_2 uuid references public.study_programs(id),
  pilihan_3 uuid references public.study_programs(id),
  pilihan_4 uuid references public.study_programs(id),
  updated_at timestamptz default now()
);

alter table public.program_selections enable row level security;

create policy "Users can manage own selections"
  on public.program_selections for all
  using (auth.uid() = user_id);

create policy "Admin can view all selections"
  on public.program_selections for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- STORAGE BUCKETS (run in Supabase dashboard or here)
-- ============================================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('question-images', 'question-images', true) on conflict do nothing;

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "Anyone can view question images"
  on storage.objects for select
  using (bucket_id = 'question-images');

create policy "Admin can manage question images"
  on storage.objects for all
  using (
    bucket_id = 'question-images' and
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- FUNCTION: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  gen_nomor text;
begin
  -- Generate random nomor_peserta_utbk format 26-XXXX-XXXXXX
  gen_nomor := '26-' || floor(random() * 9000 + 1000)::text || '-' || floor(random() * 900000 + 100000)::text;

  insert into public.profiles (
    id, email, nama, role, nisn, tempat_lahir, tanggal_lahir, asal_sekolah, npsn, nomor_peserta_utbk
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nama', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    new.raw_user_meta_data->>'nisn',
    new.raw_user_meta_data->>'tempat_lahir',
    new.raw_user_meta_data->>'tanggal_lahir',
    new.raw_user_meta_data->>'asal_sekolah',
    new.raw_user_meta_data->>'npsn',
    coalesce(new.raw_user_meta_data->>'nomor_peserta_utbk', gen_nomor)
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_questions_subtest on public.questions(subtest_id);
create index idx_answers_session on public.answers(session_id);
create index idx_exam_results_user on public.exam_results(user_id);
create index idx_study_programs_university on public.study_programs(university_id);
create index idx_exam_sessions_user on public.exam_sessions(user_id);

-- ============================================================
-- GLOBAL SETTINGS
-- ============================================================
create table public.global_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table public.global_settings enable row level security;

create policy "Anyone can read global_settings"
  on public.global_settings for select
  using (true);

create policy "Admin can manage global_settings"
  on public.global_settings for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Setup default initial value (can be changed via admin panel)
insert into public.global_settings (key, value) values ('snbt_announcement_time', (now() + interval '2 minutes')::text) on conflict (key) do update set value = excluded.value;

-- ============================================================
-- EXAM VIOLATIONS
-- ============================================================
create table public.exam_violations (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.exam_sessions(id) on delete cascade not null,
  jenis_pelanggaran text not null,
  created_at timestamptz default now()
);

alter table public.exam_violations enable row level security;

create policy "System can insert violations"
  on public.exam_violations for insert
  with check (
    exists (
      select 1 from public.exam_sessions es
      where es.id = session_id and es.user_id = auth.uid()
    )
  );

create policy "Admin can view all violations"
  on public.exam_violations for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create index idx_exam_violations_session on public.exam_violations(session_id);
