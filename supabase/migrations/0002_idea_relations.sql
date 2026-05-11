create table if not exists public.idea_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_node_id uuid not null references public.inspiration_nodes(id) on delete cascade,
  target_node_id uuid not null references public.inspiration_nodes(id) on delete cascade,
  relation_kind text not null check (
    relation_kind in (
      'derivation',
      'association',
      'support',
      'conflict',
      'analogy',
      'capture',
      'pending'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint idea_relations_not_self check (source_node_id <> target_node_id),
  constraint idea_relations_user_pair_unique unique (
    user_id,
    source_node_id,
    target_node_id
  )
);

drop trigger if exists set_idea_relations_updated_at on public.idea_relations;
create trigger set_idea_relations_updated_at
before update on public.idea_relations
for each row execute function public.set_updated_at();

create index if not exists idea_relations_user_id_idx
  on public.idea_relations(user_id);
create index if not exists idea_relations_source_node_id_idx
  on public.idea_relations(source_node_id);
create index if not exists idea_relations_target_node_id_idx
  on public.idea_relations(target_node_id);

alter table public.idea_relations enable row level security;

create policy "users read own idea relations"
on public.idea_relations for select
using (auth.uid() = user_id);

create policy "users insert own idea relations"
on public.idea_relations for insert
with check (auth.uid() = user_id);

create policy "users update own idea relations"
on public.idea_relations for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users delete own idea relations"
on public.idea_relations for delete
using (auth.uid() = user_id);
