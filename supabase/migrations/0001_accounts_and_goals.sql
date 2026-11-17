-- Accountability, step 2: accounts + goals.
-- Every table has Row Level Security. A member can only reach his own rows.
-- Partner access (step 3) and the Brotherhood feed (step 4) add policies later.

-- ---------- members ----------
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  time_zone text not null default 'America/Chicago',
  lmtlss_mode boolean not null default false,
  community_role text not null default 'member' check (community_role in ('member', 'moderator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.members enable row level security;
create policy members_self_select on public.members for select using (id = auth.uid());
create policy members_self_insert on public.members for insert with check (id = auth.uid() and community_role = 'member');
create policy members_self_update on public.members for update using (id = auth.uid())
  with check (id = auth.uid() and community_role = (select m.community_role from public.members m where m.id = auth.uid()));

-- Create the member row when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.members (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- subscriptions (from template-library/saas-blackbox-backend) ----------
-- Read-only for members. Only the Stripe webhook (service role) writes here.
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_self_select on public.subscriptions for select using (user_id = auth.uid());

-- ---------- goals ----------
create table public.goals (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  source_id text,
  commitment text not null default '',
  description text,
  next_action text,
  next_action_date date,
  guided jsonb not null default '{}'::jsonb,
  category text,
  tags text[] not null default '{}',
  template text not null default 'custom' check (template in ('sprint7', 'goal30', 'custom')),
  milestone_count smallint check (milestone_count in (4, 6)),
  health text not null default 'on_track' check (health in ('on_track', 'at_risk', 'off_track')),
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'active', 'completed', 'archived')),
  prior_lifecycle text check (prior_lifecycle in ('draft', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  unique (owner_id, source_id)
);
create index goals_owner_idx on public.goals (owner_id);
alter table public.goals enable row level security;
create policy goals_owner_all on public.goals for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A helper so child tables can say "the goal's owner".
create function public.owns_goal(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.goals where id = g and owner_id = auth.uid())
$$;

-- ---------- plan items ----------
create table public.plan_items (
  id uuid primary key,
  goal_id uuid not null references public.goals (id) on delete cascade,
  list text not null check (list in ('tasks', 'milestones')),
  title text not null,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  sort integer not null default 0
);
create index plan_items_goal_idx on public.plan_items (goal_id);
alter table public.plan_items enable row level security;
create policy plan_items_owner_all on public.plan_items for all
  using (public.owns_goal(goal_id)) with check (public.owns_goal(goal_id));

-- ---------- rooms ----------
-- Room ids are stable; names/order live in the app catalog for now.
create table public.goal_rooms (
  goal_id uuid not null references public.goals (id) on delete cascade,
  room_id text not null,
  primary key (goal_id, room_id)
);
alter table public.goal_rooms enable row level security;
create policy goal_rooms_owner_all on public.goal_rooms for all
  using (public.owns_goal(goal_id)) with check (public.owns_goal(goal_id));

-- ---------- cadences ----------
create table public.cadences (
  goal_id uuid not null references public.goals (id) on delete cascade,
  actor_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'partner')),
  frequency text not null check (frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  anchor_date date not null,
  next_due date not null,
  time_zone text not null,
  updated_at timestamptz not null default now(),
  primary key (goal_id, actor_id, role)
);
alter table public.cadences enable row level security;
create policy cadences_owner_all on public.cadences for all
  using (public.owns_goal(goal_id) and actor_id = auth.uid())
  with check (public.owns_goal(goal_id) and actor_id = auth.uid());

-- ---------- timeline (updates, check-ins, history) ----------
create table public.timeline_entries (
  id uuid primary key,
  goal_id uuid not null references public.goals (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  kind text not null check (kind in ('created', 'activated', 'update', 'checkin', 'status', 'revision', 'completed', 'archived', 'restored', 'imported')),
  at timestamptz not null default now(),
  text text,
  health text check (health in ('on_track', 'at_risk', 'off_track')),
  responses jsonb,
  occurrence date,
  visibility text not null default 'owner' check (visibility in ('owner', 'shared'))
);
create index timeline_goal_idx on public.timeline_entries (goal_id, at);
-- One check-in per scheduled date per person: a retry can't advance twice.
create unique index timeline_one_checkin_per_occurrence
  on public.timeline_entries (goal_id, author_id, occurrence)
  where kind = 'checkin' and occurrence is not null;
alter table public.timeline_entries enable row level security;
create policy timeline_owner_all on public.timeline_entries for all
  using (public.owns_goal(goal_id)) with check (public.owns_goal(goal_id) and author_id = auth.uid());

-- ---------- save_goal: one transaction per change ----------
-- p_goal: the goal row + tasks, milestones, roomIds, cadence (same shape as the app).
-- p_entries: the goal's timeline. Entries already saved are skipped by id.
-- Runs as the caller (security invoker), so RLS still decides what's allowed.
create function public.save_goal(p_goal jsonb, p_entries jsonb default '[]'::jsonb, p_time_zone text default 'America/Chicago')
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
  where g.owner_id = auth.uid();

  if not public.owns_goal(gid) then
    raise exception 'not your goal' using errcode = '42501';
  end if;

  -- New timeline entries. A check-in for a date that's already recorded is skipped,
  -- and then the cadence below is left alone.
  for e in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    -- Already saved (a resend): nothing to do.
    continue when exists (select 1 from public.timeline_entries t where t.id = (e ->> 'id')::uuid);
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

  if p_goal ? 'cadence' and jsonb_typeof(p_goal -> 'cadence') = 'object' and not dup_checkin then
    insert into public.cadences (goal_id, actor_id, role, frequency, anchor_date, next_due, time_zone)
    values (gid, auth.uid(), 'owner', p_goal -> 'cadence' ->> 'frequency',
            (p_goal -> 'cadence' ->> 'anchorDate')::date, (p_goal -> 'cadence' ->> 'nextDue')::date, p_time_zone)
    on conflict (goal_id, actor_id, role) do update set
      frequency = excluded.frequency, anchor_date = excluded.anchor_date,
      next_due = excluded.next_due, time_zone = excluded.time_zone, updated_at = now();
  end if;

  return jsonb_build_object('id', gid, 'duplicateCheckin', dup_checkin);
end $$;

-- ---------- load_goals: everything the member owns, in the app's shape ----------
create function public.load_goals() returns jsonb
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
                'health', t.health, 'responses', t.responses, 'occurrence', t.occurrence)) order by t.at)
              from public.timeline_entries t where t.goal_id = g.id), '[]'::jsonb),
    'cadence', (select jsonb_build_object('frequency', c.frequency, 'anchorDate', c.anchor_date, 'nextDue', c.next_due)
                from public.cadences c where c.goal_id = g.id and c.actor_id = auth.uid() and c.role = 'owner')
  )) order by g.created_at desc), '[]'::jsonb)
  from public.goals g
  where g.owner_id = auth.uid()
$$;

-- Drafts can be deleted outright; anything else is archived instead.
create function public.delete_draft(p_id uuid) returns void
language sql security invoker set search_path = '' as $$
  delete from public.goals where id = p_id and owner_id = auth.uid() and lifecycle = 'draft'
$$;

revoke all on function public.save_goal(jsonb, jsonb, text) from public, anon;
revoke all on function public.load_goals() from public, anon;
revoke all on function public.delete_draft(uuid) from public, anon;
grant execute on function public.save_goal(jsonb, jsonb, text) to authenticated;
grant execute on function public.load_goals() to authenticated;
grant execute on function public.delete_draft(uuid) to authenticated;
