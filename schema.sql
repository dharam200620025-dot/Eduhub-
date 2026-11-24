-- Run in Supabase SQL editor. Keep the study-materials bucket PRIVATE.
create extension if not exists pgcrypto;
create type public.app_role as enum ('student','admin');
create type public.material_kind as enum ('pdf','video');
create type public.payment_status as enum ('created','paid','failed','refunded');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 role public.app_role not null default 'student',
 created_at timestamptz not null default now()
);
create table public.materials (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 category text not null,
 subject text,
 kind public.material_kind not null default 'pdf',
 icon text,
 price numeric(10,2) not null default 0 check(price>=0),
 is_free boolean not null default false,
 file_path text not null,
 sample_path text,
 thumbnail_path text,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 material_id uuid not null references public.materials(id),
 razorpay_order_id text not null unique,
 razorpay_payment_id text unique,
 amount_paise integer not null check(amount_paise>0),
 currency text not null default 'INR',
 status public.payment_status not null default 'created',
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.entitlements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 material_id uuid not null references public.materials(id),
 payment_id uuid references public.payments(id),
 created_at timestamptz not null default now(),
 unique(user_id,material_id)
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;
create policy "profiles read own" on public.profiles for select using(auth.uid()=id);
create policy "published material readable" on public.materials for select using(published=true);
create policy "own payments readable" on public.payments for select using(auth.uid()=user_id);
create policy "own entitlements readable" on public.entitlements for select using(auth.uid()=user_id);
-- No client write policies: privileged writes use server-only service role after checks.
-- Create a PRIVATE storage bucket named study-materials. Upload files only from server/admin API.
-- Assign admin explicitly after creating the account:
-- update public.profiles set role='admin' where id='AUTH_USER_UUID';
