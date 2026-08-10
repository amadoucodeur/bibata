begin;

create extension if not exists pgcrypto;

create or replace function public.bibata_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  locale text not null default 'fr-CI',
  timezone text not null default 'Africa/Abidjan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_language text check (active_language is null or active_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  install_nudge_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_profile_id text not null check (char_length(client_profile_id) between 1 and 100),
  language_code text not null check (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  language_name text not null check (char_length(language_name) between 1 and 60),
  language_flag text not null default '',
  cefr_level text not null check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  level_confidence double precision not null default 0 check (level_confidence between 0 and 1),
  interests text[] not null default '{}',
  ability jsonb not null default '{}'::jsonb check (jsonb_typeof(ability) = 'object'),
  current_mission_id text,
  learning_plan jsonb check (learning_plan is null or jsonb_typeof(learning_plan) = 'object'),
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, language_code),
  unique (user_id, client_profile_id),
  check (coalesce(array_length(interests, 1), 0) <= 20)
);

create table if not exists public.mission_progress (
  learning_profile_id uuid not null references public.learning_profiles(id) on delete cascade,
  mission_id text not null check (char_length(mission_id) between 1 and 160),
  status text not null check (status in ('available','in_progress','completed')),
  score smallint check (score between 0 and 100),
  attempts jsonb not null default '[]'::jsonb check (jsonb_typeof(attempts) = 'array'),
  completed_at timestamptz,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (learning_profile_id, mission_id),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table if not exists public.concept_mastery (
  learning_profile_id uuid not null references public.learning_profiles(id) on delete cascade,
  concept_id text not null check (char_length(concept_id) between 1 and 160),
  exposure_count integer not null default 0 check (exposure_count >= 0),
  recognition double precision not null default 0 check (recognition between 0 and 1),
  recall double precision not null default 0 check (recall between 0 and 1),
  context_understanding double precision not null default 0 check (context_understanding between 0 and 1),
  production double precision not null default 0 check (production between 0 and 1),
  mastery_score double precision not null default 0 check (mastery_score between 0 and 1),
  confidence double precision not null default 0 check (confidence between 0 and 1),
  correct_count integer not null default 0 check (correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  last_seen_at timestamptz,
  next_suggested_exposure_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (learning_profile_id, concept_id)
);

create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  email text not null,
  mobile_phone text not null check (mobile_phone ~ '^\+?[0-9]{10,15}$'),
  country_code char(2) not null default 'CI',
  plan_code text not null default 'individual_1000' check (plan_code in ('individual_1000')),
  status text not null default 'active' check (status in ('active','grace','suspended','cancelled')),
  activated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_usage_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.billing_accounts(id) on delete cascade,
  learning_profile_id uuid references public.learning_profiles(id) on delete set null,
  event_type text not null check (event_type in ('mission_completed')),
  source_id text not null check (char_length(source_id) between 1 and 160),
  period_start date not null check (period_start = date_trunc('month', period_start)::date),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (account_id, event_type, source_id, period_start)
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.billing_accounts(id) on delete cascade,
  period_start date not null check (period_start = date_trunc('month', period_start)::date),
  amount integer not null default 1000 check (amount = 1000),
  currency char(3) not null default 'XOF' check (currency = 'XOF'),
  status text not null default 'open' check (status in ('open','pending','paid','void')),
  issued_at timestamptz not null,
  due_at timestamptz not null,
  grace_ends_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, period_start),
  check (due_at >= issued_at and grace_ends_at >= due_at),
  check ((status = 'paid' and paid_at is not null) or status <> 'paid')
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  provider text not null default 'paydunya' check (provider = 'paydunya'),
  internal_reference text not null unique,
  provider_token text unique,
  status text not null default 'created' check (status in ('created','pending','completed','failed','cancelled')),
  amount integer not null check (amount > 0),
  currency char(3) not null default 'XOF' check (currency = 'XOF'),
  checkout_url text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'paydunya'),
  provider_token text not null,
  provider_status text not null,
  event_key text not null unique,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists learning_profiles_user_idx on public.learning_profiles(user_id);
create index if not exists mission_progress_profile_status_idx on public.mission_progress(learning_profile_id, status);
create index if not exists concept_mastery_due_idx on public.concept_mastery(learning_profile_id, next_suggested_exposure_at);
create index if not exists billing_usage_account_period_idx on public.billing_usage_events(account_id, period_start);
create index if not exists billing_invoices_account_status_idx on public.billing_invoices(account_id, status, issued_at desc);
create index if not exists payment_transactions_invoice_idx on public.payment_transactions(invoice_id);
create index if not exists payment_transactions_provider_token_idx on public.payment_transactions(provider_token);

drop trigger if exists bibata_user_profiles_updated_at on public.user_profiles;
create trigger bibata_user_profiles_updated_at before update on public.user_profiles for each row execute function public.bibata_set_updated_at();
drop trigger if exists bibata_user_settings_updated_at on public.user_settings;
create trigger bibata_user_settings_updated_at before update on public.user_settings for each row execute function public.bibata_set_updated_at();
drop trigger if exists bibata_learning_profiles_updated_at on public.learning_profiles;
create trigger bibata_learning_profiles_updated_at before update on public.learning_profiles for each row execute function public.bibata_set_updated_at();
drop trigger if exists bibata_mission_progress_updated_at on public.mission_progress;
create trigger bibata_mission_progress_updated_at before update on public.mission_progress for each row execute function public.bibata_set_updated_at();
drop trigger if exists bibata_billing_accounts_updated_at on public.billing_accounts;
create trigger bibata_billing_accounts_updated_at before update on public.billing_accounts for each row execute function public.bibata_set_updated_at();
drop trigger if exists bibata_billing_invoices_updated_at on public.billing_invoices;
create trigger bibata_billing_invoices_updated_at before update on public.billing_invoices for each row execute function public.bibata_set_updated_at();
drop trigger if exists bibata_payment_transactions_updated_at on public.payment_transactions;
create trigger bibata_payment_transactions_updated_at before update on public.payment_transactions for each row execute function public.bibata_set_updated_at();

create or replace function public.bibata_handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Bibata'), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists bibata_on_auth_user_changed on auth.users;
create trigger bibata_on_auth_user_changed
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.bibata_handle_auth_user();

insert into public.user_profiles (user_id, email, display_name, avatar_url)
select id, coalesce(email, ''), left(coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), nullif(raw_user_meta_data ->> 'name', ''), nullif(split_part(coalesce(email, ''), '@', 1), ''), 'Bibata'), 80), raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (user_id) do nothing;
insert into public.user_settings (user_id) select id from auth.users on conflict (user_id) do nothing;

alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.learning_profiles enable row level security;
alter table public.mission_progress enable row level security;
alter table public.concept_mastery enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.billing_usage_events enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists learning_profiles_select_own on public.learning_profiles;
create policy learning_profiles_select_own on public.learning_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists mission_progress_select_own on public.mission_progress;
create policy mission_progress_select_own on public.mission_progress for select to authenticated using (exists (select 1 from public.learning_profiles lp where lp.id = learning_profile_id and lp.user_id = (select auth.uid())));
drop policy if exists concept_mastery_select_own on public.concept_mastery;
create policy concept_mastery_select_own on public.concept_mastery for select to authenticated using (exists (select 1 from public.learning_profiles lp where lp.id = learning_profile_id and lp.user_id = (select auth.uid())));
drop policy if exists billing_accounts_select_own on public.billing_accounts;
create policy billing_accounts_select_own on public.billing_accounts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists billing_usage_select_own on public.billing_usage_events;
create policy billing_usage_select_own on public.billing_usage_events for select to authenticated using (exists (select 1 from public.billing_accounts ba where ba.id = account_id and ba.user_id = (select auth.uid())));
drop policy if exists billing_invoices_select_own on public.billing_invoices;
create policy billing_invoices_select_own on public.billing_invoices for select to authenticated using (exists (select 1 from public.billing_accounts ba where ba.id = account_id and ba.user_id = (select auth.uid())));
drop policy if exists payment_transactions_select_own on public.payment_transactions;
create policy payment_transactions_select_own on public.payment_transactions for select to authenticated using (exists (select 1 from public.billing_invoices bi join public.billing_accounts ba on ba.id = bi.account_id where bi.id = invoice_id and ba.user_id = (select auth.uid())));

revoke all on public.user_profiles, public.user_settings, public.learning_profiles, public.mission_progress, public.concept_mastery, public.billing_accounts, public.billing_usage_events, public.billing_invoices, public.payment_transactions, public.payment_webhook_events from anon;
revoke all on public.user_profiles, public.user_settings, public.learning_profiles, public.mission_progress, public.concept_mastery, public.billing_accounts, public.billing_usage_events, public.billing_invoices, public.payment_transactions, public.payment_webhook_events from authenticated;
grant select on public.user_profiles, public.user_settings, public.learning_profiles, public.mission_progress, public.concept_mastery, public.billing_accounts, public.billing_usage_events, public.billing_invoices, public.payment_transactions to authenticated;
grant all on public.user_profiles, public.user_settings, public.learning_profiles, public.mission_progress, public.concept_mastery, public.billing_accounts, public.billing_usage_events, public.billing_invoices, public.payment_transactions, public.payment_webhook_events to service_role;

commit;
