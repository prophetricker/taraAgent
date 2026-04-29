-- Enable Supabase-friendly UUIDs and semantic vectors.
create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.inspiration_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.inspiration_nodes(id) on delete set null,
  title text not null,
  content text not null default '',
  vector vector(1536),
  position_x integer not null default 0,
  position_y integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.inspiration_nodes(id) on delete cascade,
  title text not null default '未命名对话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dandelion_fragments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid references public.inspiration_nodes(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  content text not null,
  original_context text not null,
  sentiment_vibe text,
  created_at timestamptz not null default now()
);

drop trigger if exists set_inspiration_nodes_updated_at on public.inspiration_nodes;
create trigger set_inspiration_nodes_updated_at
before update on public.inspiration_nodes
for each row execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create index if not exists inspiration_nodes_user_id_idx on public.inspiration_nodes(user_id);
create index if not exists inspiration_nodes_parent_id_idx on public.inspiration_nodes(parent_id);
create index if not exists inspiration_nodes_vector_hnsw_idx
  on public.inspiration_nodes using hnsw (vector vector_cosine_ops);
create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists conversations_node_id_idx on public.conversations(node_id);
create index if not exists messages_user_id_idx on public.messages(user_id);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists dandelion_fragments_user_id_idx on public.dandelion_fragments(user_id);
create index if not exists dandelion_fragments_node_id_idx on public.dandelion_fragments(node_id);
create index if not exists dandelion_fragments_conversation_id_idx on public.dandelion_fragments(conversation_id);

alter table public.inspiration_nodes enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.dandelion_fragments enable row level security;

create policy "users read own inspiration nodes"
on public.inspiration_nodes for select
using (auth.uid() = user_id);

create policy "users insert own inspiration nodes"
on public.inspiration_nodes for insert
with check (auth.uid() = user_id);

create policy "users update own inspiration nodes"
on public.inspiration_nodes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users delete own inspiration nodes"
on public.inspiration_nodes for delete
using (auth.uid() = user_id);

create policy "users read own conversations"
on public.conversations for select
using (auth.uid() = user_id);

create policy "users insert own conversations"
on public.conversations for insert
with check (auth.uid() = user_id);

create policy "users update own conversations"
on public.conversations for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users delete own conversations"
on public.conversations for delete
using (auth.uid() = user_id);

create policy "users read own messages"
on public.messages for select
using (auth.uid() = user_id);

create policy "users insert own messages"
on public.messages for insert
with check (auth.uid() = user_id);

create policy "users read own dandelion fragments"
on public.dandelion_fragments for select
using (auth.uid() = user_id);

create policy "users insert own dandelion fragments"
on public.dandelion_fragments for insert
with check (auth.uid() = user_id);

create policy "users delete own dandelion fragments"
on public.dandelion_fragments for delete
using (auth.uid() = user_id);
