-- Advisor fixes after 0001.
-- 1. Helper functions out of the public API: owns_goal moves to a private schema
--    (policies can still use it; REST can't call it), handle_new_user is trigger-only.
-- 2. auth.uid() wrapped in (select ...) so policies evaluate it once per query.
-- 3. Indexes on the two uncovered foreign keys.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.owns_goal(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.goals where id = g and owner_id = (select auth.uid()))
$$;
revoke all on function private.owns_goal(uuid) from public, anon;
grant execute on function private.owns_goal(uuid) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- members
drop policy members_self_select on public.members;
drop policy members_self_insert on public.members;
drop policy members_self_update on public.members;
create policy members_self_select on public.members for select using (id = (select auth.uid()));
create policy members_self_insert on public.members for insert
  with check (id = (select auth.uid()) and community_role = 'member');
create policy members_self_update on public.members for update using (id = (select auth.uid()))
  with check (id = (select auth.uid())
              and community_role = (select m.community_role from public.members m where m.id = (select auth.uid())));

-- subscriptions
drop policy subscriptions_self_select on public.subscriptions;
create policy subscriptions_self_select on public.subscriptions for select using (user_id = (select auth.uid()));

-- goals
drop policy goals_owner_all on public.goals;
create policy goals_owner_all on public.goals for all
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- children
drop policy plan_items_owner_all on public.plan_items;
create policy plan_items_owner_all on public.plan_items for all
  using (private.owns_goal(goal_id)) with check (private.owns_goal(goal_id));

drop policy goal_rooms_owner_all on public.goal_rooms;
create policy goal_rooms_owner_all on public.goal_rooms for all
  using (private.owns_goal(goal_id)) with check (private.owns_goal(goal_id));

drop policy cadences_owner_all on public.cadences;
create policy cadences_owner_all on public.cadences for all
  using (private.owns_goal(goal_id) and actor_id = (select auth.uid()))
  with check (private.owns_goal(goal_id) and actor_id = (select auth.uid()));

drop policy timeline_owner_all on public.timeline_entries;
create policy timeline_owner_all on public.timeline_entries for all
  using (private.owns_goal(goal_id))
  with check (private.owns_goal(goal_id) and author_id = (select auth.uid()));

-- save_goal used public.owns_goal; point it at the private one.
create or replace function public.save_goal(p_goal jsonb, p_entries jsonb default '[]'::jsonb, p_time_zone text default 'America/Chicago')
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  gid uuid := (p_goal ->> 'id')::uuid;
  e jsonb;
  dup_checkin boolean := false;
  ins int;
begin
  insert into public.goals as g (
    id, source_id, commitment, description, next_action, next_action_date, guided, category, tags,
    template, milestone_count, health, lifecycle, prior_lifecycle,
    created_at, updated_at, activated_at, completed_at, archived_at)
  values (
    gid, p_goal ->> 'sourceId', coalesce(p_goal ->> 'commitment', ''), p_goal ->> 'description',
    p_goal ->> 'nextAction', nullif(p_goal ->> 'nextActionDate', '')::date,
    coalesce(p_goal -> 'guided', '{}'::jsonb), p_goal ->> 'category',
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_goal -> 'tags') x), '{}'),
    coalesce(p_goal ->> 'template', 'custom'), (p_goal ->> 'milestoneCount')::smallint,
    coalesce(p_goal ->> 'health', 'on_track'), coalesce(p_goal ->> 'lifecycle', 'draft'), p_goal ->> 'priorLifecycle',
    coalesce((p_goal ->> 'createdAt')::timestamptz, now()), now(),
    (p_goal ->> 'activatedAt')::timestamptz, (p_goal ->> 'completedAt')::timestamptz, (p_goal ->> 'archivedAt')::timestamptz)
  on conflict (id) do update set
    commitment = excluded.commitment, description = excluded.description,
    next_action = excluded.next_action, next_action_date = excluded.next_action_date,
    guided = excluded.guided, category = excluded.category, tags = excluded.tags,
    template = excluded.template, milestone_count = excluded.milestone_count,
    health = excluded.health, lifecycle = excluded.lifecycle, prior_lifecycle = excluded.prior_lifecycle,
    updated_at = now(), activated_at = excluded.activated_at,
    completed_at = excluded.completed_at, archived_at = excluded.archived_at
  where g.owner_id = (select auth.uid());

  if not private.owns_goal(gid) then
    raise exception 'not your goal' using errcode = '42501';
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    -- Already saved (a resend): nothing to do.
    continue when exists (select 1 from public.timeline_entries t where t.id = (e ->> 'id')::uuid);
    insert into public.timeline_entries (id, goal_id, kind, at, text, health, responses, occurrence)
    values ((e ->> 'id')::uuid, gid, e ->> 'kind', coalesce((e ->> 'at')::timestamptz, now()), e ->> 'text',
            e ->> 'health', e -> 'responses', nullif(e ->> 'occurrence', '')::date)
    on conflict do nothing;
    get diagnostics ins = row_count;
    -- A new check-in for a date already recorded: keep the server's schedule.
    if ins = 0 and e ->> 'kind' = 'checkin' then dup_checkin := true; end if;
  end loop;

  delete from public.plan_items where goal_id = gid;
  insert into public.plan_items (id, goal_id, list, title, due_date, completed, completed_at, sort)
  select (i ->> 'id')::uuid, gid, l.list, i ->> 'title', nullif(i ->> 'dueDate', '')::date,
         coalesce((i ->> 'completed')::boolean, false), (i ->> 'completedAt')::timestamptz,
         coalesce((i ->> 'order')::int, 0)
  from (values ('tasks'), ('milestones')) l(list),
       jsonb_array_elements(coalesce(p_goal -> l.list, '[]'::jsonb)) i;

  delete from public.goal_rooms where goal_id = gid;
  insert into public.goal_rooms (goal_id, room_id)
  select gid, r from jsonb_array_elements_text(coalesce(p_goal -> 'roomIds', '[]'::jsonb)) r
  on conflict do nothing;

  if p_goal ? 'cadence' and jsonb_typeof(p_goal -> 'cadence') = 'object' and not dup_checkin then
    insert into public.cadences (goal_id, actor_id, role, frequency, anchor_date, next_due, time_zone)
    values (gid, (select auth.uid()), 'owner', p_goal -> 'cadence' ->> 'frequency',
            (p_goal -> 'cadence' ->> 'anchorDate')::date, (p_goal -> 'cadence' ->> 'nextDue')::date, p_time_zone)
    on conflict (goal_id, actor_id, role) do update set
      frequency = excluded.frequency, anchor_date = excluded.anchor_date,
      next_due = excluded.next_due, time_zone = excluded.time_zone, updated_at = now();
  end if;

  return jsonb_build_object('id', gid, 'duplicateCheckin', dup_checkin);
end $$;

drop function public.owns_goal(uuid);

create index cadences_actor_idx on public.cadences (actor_id);
create index timeline_author_idx on public.timeline_entries (author_id);
