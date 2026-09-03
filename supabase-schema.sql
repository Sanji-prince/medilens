-- ============================================================
-- MediLens — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Tables

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  age int check (age is null or (age >= 0 and age < 150)),
  chronic_conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_family_members_user_id on public.family_members(user_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  storage_path text,
  extracted_summary jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_documents_family_member_id on public.documents(family_member_id);

create table if not exists public.vitals_log (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  type text not null check (type in ('blood_pressure', 'blood_sugar', 'weight')),
  value text not null,
  date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'document')),
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_vitals_family_member_date on public.vitals_log(family_member_id, date desc);

-- 2. Row Level Security

alter table public.family_members enable row level security;
alter table public.documents      enable row level security;
alter table public.vitals_log     enable row level security;

-- Drop old policies if they exist so this script is idempotent
drop policy if exists "own family" on public.family_members;
drop policy if exists "own docs" on public.documents;
drop policy if exists "own vitals" on public.vitals_log;

-- Direct policy syntax: user can only touch rows where they are the owner.
-- These apply to any authenticated request (JWT with a valid user id).
create policy "own family" on public.family_members
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own docs" on public.documents
  for all
  using (exists (
    select 1 from public.family_members m
    where m.id = documents.family_member_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.family_members m
    where m.id = documents.family_member_id and m.user_id = auth.uid()
  ));

create policy "own vitals" on public.vitals_log
  for all
  using (exists (
    select 1 from public.family_members m
    where m.id = vitals_log.family_member_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.family_members m
    where m.id = vitals_log.family_member_id and m.user_id = auth.uid()
  ));

-- 4. Migration for existing tables (run if documents table already exists without extracted_summary)
-- alter table public.documents add column if not exists extracted_summary jsonb;

-- 4b. Vitals auto-extraction: tag rows as manual vs document-sourced, link back to source document.
-- alter table public.vitals_log add column if not exists source text not null default 'manual' check (source in ('manual', 'document'));
-- alter table public.vitals_log add column if not exists document_id uuid references public.documents(id) on delete set null;

-- 5. Storage bucket (run in Dashboard → Storage → New Bucket)
--    Name: "documents"
--    Public: NO (private — we use signed URLs)
