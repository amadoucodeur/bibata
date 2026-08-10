alter table public.concept_mastery
  add column if not exists conversation_use_count integer not null default 0 check (conversation_use_count >= 0),
  add column if not exists assimilated_at timestamptz;

create index if not exists concept_mastery_assimilated_idx
  on public.concept_mastery(learning_profile_id, assimilated_at)
  where assimilated_at is not null;
