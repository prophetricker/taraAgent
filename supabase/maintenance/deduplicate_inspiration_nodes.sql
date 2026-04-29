-- Safe duplicate cleanup for manually run maintenance.
-- Review the rows first. This keeps the earliest node for each
-- (user_id, parent_id, title) group and deletes later duplicates.
--
-- Replace the UUID below before running the DELETE statement.

-- Preview duplicates:
select
  user_id,
  parent_id,
  title,
  count(*) as duplicate_count,
  array_agg(id order by created_at asc) as node_ids
from public.inspiration_nodes
where user_id = '00000000-0000-0000-0000-000000000000'
group by user_id, parent_id, title
having count(*) > 1;

-- Delete duplicates after previewing:
-- with ranked_nodes as (
--   select
--     id,
--     row_number() over (
--       partition by user_id, parent_id, title
--       order by created_at asc
--     ) as duplicate_rank
--   from public.inspiration_nodes
--   where user_id = '00000000-0000-0000-0000-000000000000'
-- )
-- delete from public.inspiration_nodes
-- where id in (
--   select id
--   from ranked_nodes
--   where duplicate_rank > 1
-- );
