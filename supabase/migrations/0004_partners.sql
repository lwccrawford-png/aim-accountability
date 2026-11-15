-- Step 3: one accountability partner per goal.
-- Partners never get table access. Every partner read and write goes through a
-- security definer function that checks the live partnership first, so removing
-- a partner cuts access on his very next request.

create extension if not exists pgcrypto with schema extensions;

-- ---------- invites ----------
create table public.goal_invites (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  recipient_email text not null,
  token_hash text not null unique, -- sha256 of the link token; the token itself is never stored
  scope jsonb not null default '{"checkins": true, "details": false}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index goal_invites_goal_idx on public.goal_invites (goal_id);
create index goal_invites_owner_idx on public.goal_invites (owner_id);
alter table public.goal_invites enable row level security;
-- Owners can see their invites. All writes go through functions.
create policy goal_invites_owner_select on public.goal_invites for select using (owner_id = (select auth.uid()));

-- ---------- partnerships ----------
create table public.goal_partners (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  partner_id uuid not null references public.members (id) on delete cascade,
  invite_id uuid references public.goal_invites (id) on delete set null,
  scope jsonb not null,
  accepted_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('left', 'removed', 'replaced'))
);
-- One accepted partner per goal at a time.
create unique index goal_partners_one_active on public.goal_partners (goal_id) where ended_at is null;
create index goal_partners_partner_idx on public.goal_partners (partner_id);
create index goal_partners_invite_idx on public.goal_partners (invite_id);
alter table public.goal_partners enable row level security;
create policy goal_partners_owner_select on public.goal_partners for select using (private.owns_goal(goal_id));

-- ---------- shared thread ----------
alter table public.timeline_entries drop constraint timeline_entries_kind_check;
alter table public.timeline_entries add constraint timeline_entries_kind_check check (kind in (
  'created', 'activated', 'update', 'checkin', 'status', 'revision', 'completed', 'archived', 'restored', 'imported',
  'partner_checkin', 'question', 'suggestion', 'reply', 'partner_joined', 'partner_left'));
alter table public.timeline_entries
  add column suggested jsonb,
  add column resolution text check (resolution in ('accepted', 'dismissed')),
  add column resolved_at timestamptz;
create unique index timeline_one_partner_checkin_per_occurrence
  on public.timeline_entries (goal_id, author_id, occurrence)
  where kind = 'partner_checkin' and occurrence is not null;

-- The live partnership for a goal, if the caller is its partner.
create function private.active_partnership(g uuid) returns public.goal_partners
language sql stable security definer set search_path = '' as $$
  select * from public.goal_partners
  where goal_id = g and partner_id = (select auth.uid()) and ended_at is null
$$;
revoke all on function private.active_partnership(uuid) from public, anon;
grant execute on function private.active_partnership(uuid) to authenticated;

-- Partner cadences: a partner manages only his own row, only while he's the partner.
drop policy cadences_owner_all on public.cadences;
create policy cadences_actor_all on public.cadences for all
  using (actor_id = (select auth.uid()) and (
    (role = 'owner' and private.owns_goal(goal_id)) or
    (role = 'partner' and (private.active_partnership(goal_id)).id is not null)))
  with check (actor_id = (select auth.uid()) and (
    (role = 'owner' and private.owns_goal(goal_id)) or
    (role = 'partner' and (private.active_partnership(goal_id)).id is not null)));
-- Owners can see their partner's rhythm (not edit it).
create policy cadences_owner_sees_partner on public.cadences for select
  using (role = 'partner' and private.owns_goal(goal_id));

-- ---------- helpers ----------
create function private.member_name(m uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(trim(display_name), ''), split_part(u.email, '@', 1))
  from public.members mm join auth.users u on u.id = mm.id where mm.id = m
$$;
revoke all on function private.member_name(uuid) from public, anon;
grant execute on function private.member_name(uuid) to authenticated;

-- ---------- owner: create / list / revoke invites ----------
create function public.create_invite(p_goal uuid, p_email text, p_scope jsonb default '{"checkins": true, "details": false}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  tok text := encode(extensions.gen_random_bytes(24), 'hex');
  inv public.goal_invites;
  me text := lower((select email from auth.users where id = (select auth.uid())));
begin
  if not private.owns_goal(p_goal) then raise exception 'not your goal' using errcode = '42501'; end if;
  if p_email is null or position('@' in p_email) = 0 then raise exception 'enter his email' using errcode = '22023'; end if;
  if lower(trim(p_email)) = me then raise exception 'invite another man, not yourself' using errcode = '22023'; end if;
  if (select lifecycle from public.goals where id = p_goal) <> 'active' then
    raise exception 'only active goals can have a partner' using errcode = '22023';
  end if;
  -- One open invite per goal: a new one replaces any still pending.
  update public.goal_invites set status = 'revoked', responded_at = now()
    where goal_id = p_goal and status = 'pending';
  insert into public.goal_invites (goal_id, owner_id, recipient_email, token_hash, scope)
  values (p_goal, (select auth.uid()), lower(trim(p_email)),
          encode(extensions.digest(tok, 'sha256'), 'hex'),
          jsonb_build_object('checkins', coalesce((p_scope ->> 'checkins')::boolean, true),
                             'details', coalesce((p_scope ->> 'details')::boolean, false)))
  returning * into inv;
  return jsonb_build_object('id', inv.id, 'token', tok, 'expiresAt', inv.expires_at);
end $$;

create function public.revoke_invite(p_invite uuid) returns void
language sql security definer set search_path = '' as $$
  update public.goal_invites set status = 'revoked', responded_at = now()
  where id = p_invite and owner_id = (select auth.uid()) and status = 'pending'
$$;

-- ---------- recipient: preview / accept / decline ----------
-- The preview names who's asking and nothing about the goal.
create function public.invite_preview(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object(
      'from', private.member_name(i.owner_id),
      'status', case when i.status = 'pending' and i.expires_at < now() then 'expired' else i.status end,
      'expiresAt', i.expires_at,
      'forEmail', regexp_replace(i.recipient_email, '^(.).*(@.*)$', '\1•••\2'))
    from public.goal_invites i
    where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')),
    jsonb_build_object('status', 'not_found'))
$$;

create function public.respond_invite(p_token text, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.goal_invites;
  me uuid := (select auth.uid());
  u auth.users;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into u from auth.users where id = me;
  select * into inv from public.goal_invites
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if inv.id is null then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if inv.status <> 'pending' then raise exception 'this invite is %', inv.status using errcode = '22023'; end if;
  if inv.expires_at < now() then raise exception 'this invite has expired' using errcode = '22023'; end if;
  if lower(u.email) <> inv.recipient_email or u.email_confirmed_at is null then
    raise exception 'this invite was sent to a different email' using errcode = '42501';
  end if;
  if inv.owner_id = me then raise exception 'you can''t partner on your own goal' using errcode = '22023'; end if;

  if not p_accept then
    update public.goal_invites set status = 'declined', responded_at = now() where id = inv.id;
    return jsonb_build_object('status', 'declined');
  end if;

  insert into public.members (id) values (me) on conflict do nothing;
  -- Replacing a partner: the old one's access ends now.
  update public.goal_partners set ended_at = now(), end_reason = 'replaced'
    where goal_id = inv.goal_id and ended_at is null;
  delete from public.cadences where goal_id = inv.goal_id and role = 'partner';
  insert into public.goal_partners (goal_id, partner_id, invite_id, scope)
    values (inv.goal_id, me, inv.id, inv.scope);
  update public.goal_invites set status = 'accepted', responded_at = now() where id = inv.id;
  insert into public.timeline_entries (id, goal_id, author_id, kind, visibility)
    values (gen_random_uuid(), inv.goal_id, me, 'partner_joined', 'shared');
  return jsonb_build_object('status', 'accepted', 'goalId', inv.goal_id);
end $$;

-- ---------- either side: end it ----------
create function public.end_partnership(p_goal uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  p public.goal_partners;
  reason text;
begin
  select * into p from public.goal_partners where goal_id = p_goal and ended_at is null for update;
  if p.id is null then return; end if;
  if p.partner_id = me then reason := 'left';
  elsif private.owns_goal(p_goal) then reason := 'removed';
  else raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.goal_partners set ended_at = now(), end_reason = reason where id = p.id;
  delete from public.cadences where goal_id = p_goal and role = 'partner';
  insert into public.timeline_entries (id, goal_id, author_id, kind, visibility)
    values (gen_random_uuid(), p_goal, p.partner_id, 'partner_left', 'shared');
end $$;

-- ---------- shared thread: post as owner or partner ----------
create function public.post_shared(p_goal uuid, p_id uuid, p_kind text, p_text text default null,
  p_responses jsonb default null, p_suggested jsonb default null, p_occurrence date default null,
  p_next_due date default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  is_owner boolean := private.owns_goal(p_goal);
  p public.goal_partners := private.active_partnership(p_goal);
  ins int;
begin
  if not is_owner and p.id is null then raise exception 'not your goal' using errcode = '42501'; end if;
  if p_kind not in ('partner_checkin', 'question', 'suggestion', 'reply') then
    raise exception 'unknown post' using errcode = '22023';
  end if;
  if p_kind in ('partner_checkin', 'suggestion') and p.id is null then
    raise exception 'only the partner can post that' using errcode = '42501';
  end if;
  if exists (select 1 from public.timeline_entries where id = p_id) then
    return jsonb_build_object('id', p_id, 'duplicate', true); -- a retry
  end if;
  insert into public.timeline_entries (id, goal_id, author_id, kind, text, responses, suggested, occurrence, visibility)
    values (p_id, p_goal, me, p_kind, p_text, p_responses, p_suggested,
            case when p_kind = 'partner_checkin' then p_occurrence end, 'shared')
    on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return jsonb_build_object('id', p_id, 'duplicate', true); end if;
  if p_kind = 'partner_checkin' and p_occurrence is not null and p_next_due is not null then
    update public.cadences set next_due = p_next_due, updated_at = now()
      where goal_id = p_goal and actor_id = me and role = 'partner' and next_due = p_occurrence;
  end if;
  return jsonb_build_object('id', p_id, 'duplicate', false);
end $$;

-- Owner accepts or dismisses a suggestion.
create function public.resolve_suggestion(p_entry uuid, p_resolution text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_resolution not in ('accepted', 'dismissed') then raise exception 'bad resolution' using errcode = '22023'; end if;
  update public.timeline_entries t set resolution = p_resolution, resolved_at = now()
    where t.id = p_entry and t.kind = 'suggestion' and t.resolution is null and private.owns_goal(t.goal_id);
end $$;

-- ---------- partner's view ----------
-- What a partner sees: the shared plan and the thread since he joined. Never the
-- owner's private notes, and the "why" and plan details only if the owner shared them.
create function public.load_partnerships() returns jsonb
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

-- ---------- owner's view of partner + invites, folded into load_goals ----------
create function public.goal_partner_info(p_goal uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when private.owns_goal(p_goal) then jsonb_strip_nulls(jsonb_build_object(
    'partner', (select jsonb_build_object('name', private.member_name(p.partner_id), 'since', p.accepted_at, 'scope', p.scope,
                  'cadence', (select jsonb_build_object('frequency', c.frequency, 'nextDue', c.next_due) from public.cadences c
                              where c.goal_id = p.goal_id and c.actor_id = p.partner_id and c.role = 'partner'))
                from public.goal_partners p where p.goal_id = p_goal and p.ended_at is null),
    'invites', (select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.recipient_email, 'scope', i.scope,
                  'status', case when i.status = 'pending' and i.expires_at < now() then 'expired' else i.status end,
                  'expiresAt', i.expires_at, 'createdAt', i.created_at) order by i.created_at desc)
                from public.goal_invites i where i.goal_id = p_goal)
  )) end
$$;

-- load_goals now also returns each entry's author and the partner info.
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
    'cadence', (select jsonb_build_object('frequency', c.frequency, 'anchorDate', c.anchor_date, 'nextDue', c.next_due)
                from public.cadences c where c.goal_id = g.id and c.actor_id = (select auth.uid()) and c.role = 'owner'),
    'sharing', public.goal_partner_info(g.id)
  )) order by g.created_at desc), '[]'::jsonb)
  from public.goals g
  where g.owner_id = (select auth.uid())
$$;

-- Timeline: the owner reads everything on his goal but can only write his own
-- entries. Partners have no table access at all (functions above).
drop policy timeline_owner_all on public.timeline_entries;
create policy timeline_owner_select on public.timeline_entries for select using (private.owns_goal(goal_id));
create policy timeline_owner_insert on public.timeline_entries for insert
  with check (private.owns_goal(goal_id) and author_id = (select auth.uid())
              and kind not in ('partner_checkin', 'suggestion', 'partner_joined', 'partner_left'));
create policy timeline_owner_update on public.timeline_entries for update
  using (private.owns_goal(goal_id) and author_id = (select auth.uid()))
  with check (private.owns_goal(goal_id) and author_id = (select auth.uid()));
create policy timeline_owner_delete on public.timeline_entries for delete
  using (private.owns_goal(goal_id) and author_id = (select auth.uid()));

-- Grants
revoke all on function public.create_invite(uuid, text, jsonb) from public, anon;
revoke all on function public.revoke_invite(uuid) from public, anon;
revoke all on function public.respond_invite(text, boolean) from public, anon;
revoke all on function public.end_partnership(uuid) from public, anon;
revoke all on function public.post_shared(uuid, uuid, text, text, jsonb, jsonb, date, date) from public, anon;
revoke all on function public.resolve_suggestion(uuid, text) from public, anon;
revoke all on function public.load_partnerships() from public, anon;
revoke all on function public.goal_partner_info(uuid) from public, anon;
revoke all on function public.invite_preview(text) from public;
grant execute on function public.create_invite(uuid, text, jsonb) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.respond_invite(text, boolean) to authenticated;
grant execute on function public.end_partnership(uuid) to authenticated;
grant execute on function public.post_shared(uuid, uuid, text, text, jsonb, jsonb, date, date) to authenticated;
grant execute on function public.resolve_suggestion(uuid, text) to authenticated;
grant execute on function public.load_partnerships() to authenticated;
grant execute on function public.goal_partner_info(uuid) to authenticated;
-- The invite page shows "from" before the recipient signs in.
grant execute on function public.invite_preview(text) to anon, authenticated;
