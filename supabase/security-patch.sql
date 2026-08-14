-- Security Patch for SNBT Tryout
-- Fixes for multiple privilege escalation and data tampering vulnerabilities

-- 1A. Fix handle_new_user() trigger - Privilege Escalation via Signup
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
    'user', -- FIXED: Always set to 'user' to prevent signup privilege escalation
    new.raw_user_meta_data->>'nisn',
    new.raw_user_meta_data->>'tempat_lahir',
    nullif(new.raw_user_meta_data->>'tanggal_lahir', '')::date,
    new.raw_user_meta_data->>'asal_sekolah',
    new.raw_user_meta_data->>'npsn',
    coalesce(new.raw_user_meta_data->>'nomor_peserta_utbk', gen_nomor)
  );
  return new;
end;
$$;

-- 1B. Fix profiles UPDATE RLS - Privilege Escalation via Profile Update
create or replace function public.prevent_role_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      new.role = old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_role_unchanged on public.profiles;
create trigger ensure_role_unchanged
  before update on public.profiles
  for each row execute procedure public.prevent_role_update();

-- 1C. Create a secure view for exam questions that HIDES answer keys
drop view if exists public.questions_exam;
create view public.questions_exam as
select 
  id, subtest_id, nomor, konten, gambar_url, 
  pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, created_at
from public.questions;

-- Grant access to authenticated users
grant select on public.questions_exam to authenticated;

-- Drop the old policy that allowed reading answers directly from questions table
drop policy if exists "Authenticated users can read questions during exam" on public.questions;

-- Re-create policy but only for admins
create policy "Admins can read questions"
  on public.questions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- 1D. Fix exam_results INSERT RLS
alter table public.exam_results drop constraint if exists check_score_ranges;
alter table public.exam_results
  add constraint check_score_ranges check (
    (skor_penalaran_umum is null or (skor_penalaran_umum >= 0 and skor_penalaran_umum <= 1000)) and
    (skor_ppu is null or (skor_ppu >= 0 and skor_ppu <= 1000)) and
    (skor_pbm is null or (skor_pbm >= 0 and skor_pbm <= 1000)) and
    (skor_pk is null or (skor_pk >= 0 and skor_pk <= 1000)) and
    (skor_literasi_id is null or (skor_literasi_id >= 0 and skor_literasi_id <= 1000)) and
    (skor_literasi_id_saintek is null or (skor_literasi_id_saintek >= 0 and skor_literasi_id_saintek <= 1000)) and
    (skor_literasi_id_soshum is null or (skor_literasi_id_soshum >= 0 and skor_literasi_id_soshum <= 1000)) and
    (skor_literasi_en is null or (skor_literasi_en >= 0 and skor_literasi_en <= 1000)) and
    (skor_penalaran_matematika is null or (skor_penalaran_matematika >= 0 and skor_penalaran_matematika <= 1000))
  );

create or replace function public.check_exam_result_session()
returns trigger
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.exam_sessions where id = new.session_id and user_id = new.user_id) then
    raise exception 'Session does not belong to user';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_exam_result_session on public.exam_results;
create trigger ensure_exam_result_session
  before insert on public.exam_results
  for each row execute procedure public.check_exam_result_session();


-- 1E. Fix answers table RLS
create or replace function public.prevent_answer_benar_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'INSERT' and new.benar is not null) or (tg_op = 'UPDATE' and new.benar is distinct from old.benar) then
    if auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      if tg_op = 'INSERT' then
        new.benar = null;
      else
        new.benar = old.benar;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_answer_benar_unchanged on public.answers;
create trigger ensure_answer_benar_unchanged
  before insert or update on public.answers
  for each row execute procedure public.prevent_answer_benar_update();
