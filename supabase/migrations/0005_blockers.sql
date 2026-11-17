-- Blockers: what's in the way, named as perceived or real.
-- The owner names it and makes the final call. His partner adds his own read
-- (and a note) through set_blocker_view; he can't edit anything else.

create table public.blockers (
  id uuid primary key,
  goal_id uuid not null references public.goals (id) on delete cascade,
  text text not null,
  owner_view text check (owner_view in ('perceived', 'real')),
  partner_view text check (partner_view in ('perceived', 'real')),
  partner_note text,
  partner_id uuid references public.members (id) on delete set null,
  partner_at timestamptz,
  next_move text,
  status text not null default 'named' check (status in ('named', 'tested', 'cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cleared_at timestamptz
);
create index blockers_goal_idx on public.blockers (goal_id);
create index blockers_partner_idx on public.blockers (partner_id);
alter table public.blockers enable row level security;
create policy blockers_owner_all on public.blockers for all
  using (private.owns_goal(goal_id)) with check (private.owns_goal(goal_id));

-- Partner's read on a blocker. Only the live partner; only his two fields.
create function public.set_blocker_view(p_blocker uuid, p_view text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.blockers;
begin
  if p_view not in ('perceived', 'real') then raise exception 'pick perceived or real' using errcode = '22023'; end if;
  select * into b from public.blockers where id = p_blocker;
  if b.id is null or (private.active_partnership(b.goal_id)).id is null then
    raise exception 'not shared with you' using errcode = '42501';
  end if;
  update public.blockers set partner_view = p_view, partner_note = nullif(trim(p_note), ''),
    partner_id = (select auth.uid()), partner_at = now(), updated_at = now()
  where id = p_blocker;
end $$;
revoke all on function public.set_blocker_view(uuid, text, text) from public, anon;
grant execute on function public.set_blocker_view(uuid, text, text) to authenticated;

create function private.blockers_json(g uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', b.id, 'text', b.text, 'ownerView', b.owner_view, 'partnerView', b.partner_view,
    'partnerNote', b.partner_note, 'partnerName', case when b.partner_id is not null then private.member_name(b.partner_id) end,
    'nextMove', b.next_move, 'status', b.status, 'createdAt', b.created_at, 'clearedAt', b.cleared_at)) order by b.created_at), '[]'::jsonb)
  from public.blockers b where b.goal_id = g
$$;
revoke all on function private.blockers_json(uuid) from public, anon;
grant execute on function private.blockers_json(uuid) to authenticated;

-- save_goal: same as before, plus the owner's blocker fields. Partner fields are never overwritten here.
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
    continue when exists (select 1 from public.timeline_entries t where t.id = (e ->> 'id')::uuid);
    continue when e ->> 'kind' in ('partner_checkin', 'suggestion', 'partner_joined', 'partner_left', 'question', 'reply');
    insert into public.timeline_entries (id, goal_id, kind, at, text, health, responses, occurrence)
    values ((e ->> 'id')::uuid, gid, e ->> 'kind', coalesce((e ->> 'at')::timestamptz, now()), e ->> 'text',
            e ->> 'health', e -> 'responses', nullif(e ->> 'occurrence', '')::date)
    on conflict do nothing;
    get diagnostics ins = row_count;
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

  -- Blockers: owner fields only. Missing from the list = the owner removed it.
  if p_goal ? 'blockers' then
    delete from public.blockers where goal_id = gid
      and id not in (select (b ->> 'id')::uuid from jsonb_array_elements(p_goal -> 'blockers') b);
    insert into public.blockers as x (id, goal_id, text, owner_view, next_move, status, created_at, cleared_at)
    select (b ->> 'id')::uuid, gid, b ->> 'text', b ->> 'ownerView', b ->> 'nextMove',
           coalesce(b ->> 'status', 'named'), coalesce((b ->> 'createdAt')::timestamptz, now()), (b ->> 'clearedAt')::timestamptz
    from jsonb_array_elements(p_goal -> 'blockers') b
    on conflict (id) do update set
      text = excluded.text, owner_view = excluded.owner_view, next_move = excluded.next_move,
      status = excluded.status, cleared_at = excluded.cleared_at, updated_at = now()
    where x.goal_id = gid;
  end if;

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

create or replace function public.load_goals() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', g.id, 'sourceId', g.source_id, 'commitment', g.commitment, 'description', g.description,
    'nextAction', g.next_action, 'nextActionDate', g.next_action_date, 'guided', g.guided,
    'category', g.category, 'tags', to_jsonb(g.tags), 'template', g.template,
    'milestoneCount', g.milestone_count, 'health', g.health, 'lifecycle', g.lifecycle,
    'priorLifecycle', g.prior_lifecycle, 'createdAt', g.created_at, 'updatedAt', g.updated_at,
    'activatedAt', g.activated_at, 'completedAt', g.completed_at, 'archivedAt', g.archived_at,
    'roomIds', coalesce((select jsonb_agg(r.room_id) from public.goal_rooms r where r.goal_id = g.id), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'title', p.title, 'dueDate', p.due_date,
                'completed', p.completed, 'completedAt', p.completed_at, 'order', p.sort)) order by p.sort)
              from public.plan_items p where p.goal_id = g.id and p.list = 'tasks'), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'title', p.title, 'dueDate', p.due_date,
                'completed', p.completed, 'completedAt', p.completed_at, 'order', p.sort)) order by p.sort)
              from public.plan_items p where p.goal_id = g.id and p.list = 'milestones'), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', t.id, 'kind', t.kind, 'at', t.at, 'text', t.text,
                'health', t.health, 'responses', t.responses, 'occurrence', t.occurrence,
                'suggested', t.suggested, 'resolution', t.resolution,
                'author', case when t.author_id <> g.owner_id then private.member_name(t.author_id) end)) order by t.at)
              from public.timeline_entries t where t.goal_id = g.id), '[]'::jsonb),
    'blockers', private.blockers_json(g.id),
    'cadence', (select jsonb_build_object('frequency', c.frequency, 'anchorDate', c.anchor_date, 'nextDue', c.next_due)
                from public.cadences c where c.goal_id = g.id and c.actor_id = (select auth.uid()) and c.role = 'owner'),
    'sharing', public.goal_partner_info(g.id)
  )) order by g.created_at desc), '[]'::jsonb)
  from public.goals g
  where g.owner_id = (select auth.uid())
$$;

create or replace function public.load_partnerships() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'goalId', g.id,
    'ownerName', private.member_name(g.owner_id),
    'since', p.accepted_at,
    'scope', p.scope,
    'commitment', g.commitment,
    'nextAction', g.next_action,
    'nextActionDate', g.next_action_date,
    'health', g.health,
    'lifecycle', g.lifecycle,
    'guided', case when (p.scope ->> 'details')::boolean then g.guided end,
    'items', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', i.id, 'title', i.title, 'dueDate', i.due_date,
                'completed', i.completed, 'list', i.list)) order by i.list desc, i.sort)
              from public.plan_items i where i.goal_id = g.id), '[]'::jsonb),
    'blockers', private.blockers_json(g.id),
    'cadence', (select jsonb_build_object('frequency', c.frequency, 'anchorDate', c.anchor_date, 'nextDue', c.next_due)
                from public.cadences c where c.goal_id = g.id and c.actor_id = p.partner_id and c.role = 'partner'),
    'thread', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', t.id, 'kind', t.kind, 'at', t.at, 'text', t.text, 'health', t.health,
                'responses', t.responses, 'suggested', t.suggested, 'resolution', t.resolution,
                'occurrence', t.occurrence,
                'author', private.member_name(t.author_id), 'mine', t.author_id = p.partner_id)) order by t.at)
              from public.timeline_entries t
              where t.goal_id = g.id and t.at >= p.accepted_at - interval '1 second'
                and (t.visibility = 'shared'
                     or ((p.scope ->> 'checkins')::boolean and t.kind in ('checkin', 'completed')))), '[]'::jsonb)
  )) order by p.accepted_at desc), '[]'::jsonb)
  from public.goal_partners p join public.goals g on g.id = p.goal_id
  where p.partner_id = (select auth.uid()) and p.ended_at is null and g.lifecycle in ('active', 'completed')
$$;
