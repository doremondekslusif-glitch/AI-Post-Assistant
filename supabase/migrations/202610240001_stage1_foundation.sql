-- AI Post Assistant: Stage 1 foundation.
-- All application data is accessed through trusted server code. Do not grant client roles direct table access.
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Proyek tanpa judul',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  media_kind text not null check (media_kind in ('image','video')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  provider text,
  model text,
  status text not null default 'queued' check (status in ('queued','processing','completed','retrying','failed','cancelled')),
  visual_observations jsonb not null default '{}'::jsonb,
  extracted_text jsonb not null default '[]'::jsonb,
  user_facts jsonb not null default '[]'::jsonb,
  unverified_claims jsonb not null default '[]'::jsonb,
  corrected_analysis jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null,
  output_type text not null check (output_type in ('caption','hashtags','title','cta','ideas','alt_text','slide_summary','posting_time')),
  content text not null default '',
  status text not null default 'draft' check (status in ('draft','ready','scheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_output_id uuid not null references public.content_outputs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content text not null,
  source text not null default 'user' check (source in ('user','ai','platform_adaptation','restore')),
  created_at timestamptz not null default now(),
  unique (content_output_id, version_number)
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  job_type text not null check (job_type in ('image_analysis','video_analysis','content_generation','ocr','transcription')),
  status text not null default 'queued' check (status in ('queued','processing','completed','retrying','failed','cancelled')),
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  content_output_id uuid references public.content_outputs(id) on delete set null,
  platform text not null,
  planned_for timestamptz,
  status text not null default 'planned' check (status in ('planned','draft','published_externally','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_project_position_idx on public.assets(project_id, position);
create index if not exists analyses_project_created_idx on public.analyses(project_id, created_at desc);
create index if not exists content_outputs_project_platform_idx on public.content_outputs(project_id, platform);
create index if not exists content_versions_output_version_idx on public.content_versions(content_output_id, version_number desc);
create index if not exists generation_jobs_status_created_idx on public.generation_jobs(status, created_at);
create index if not exists planning_items_planned_for_idx on public.planning_items(planned_for);

-- Defense in depth: no direct access from browser-facing roles. Server-side service credentials only.
alter table public.projects enable row level security;
alter table public.assets enable row level security;
alter table public.analyses enable row level security;
alter table public.content_outputs enable row level security;
alter table public.content_versions enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.preferences enable row level security;
alter table public.planning_items enable row level security;

revoke all on table public.projects, public.assets, public.analyses, public.content_outputs,
  public.content_versions, public.generation_jobs, public.preferences, public.planning_items
  from anon, authenticated;

-- Private 50 MB-per-object storage bucket. Server service-role operations bypass client RLS policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-originals',
  'media-originals',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are added for anon/authenticated: direct browser access is denied.
-- The application must authorize every server-side operation and use short-lived signed URLs when needed.
