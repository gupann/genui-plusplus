-- Run in Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists participants (
  id text primary key,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participant_profiles (
  participant_id text primary key references participants(id) on delete cascade,
  name text,
  current_profession text,
  past_work text,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null references participants(id) on delete cascade,
  stage_id integer not null,
  task_id integer not null,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_study_sessions_participant_stage_task
  on study_sessions (participant_id, stage_id, task_id, updated_at desc);

create table if not exists study_session_snapshots (
  session_id uuid primary key references study_sessions(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
