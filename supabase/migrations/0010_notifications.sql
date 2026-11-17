-- In-app notifications: the bell. A man is told when the other man on a goal does
-- something: his brother checks in, asks, suggests, replies, joins or leaves.
-- Rows are written by triggers only. A member can read his own and mark them read.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('checkin', 'completed', 'question', 'reply', 'partner_checkin', 'suggestion',
                                     'partner_joined', 'left', 'removed', 'blocker_read')),
  -- Which side of the goal the reader is on, so the app knows where to send him.
  side text not null check (side in ('owner', 'partner')),
  goal_id uuid references public.goals (id) on delete cascade,
  actor_name text,
  goal_text text,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_member_idx on public.notifications (member_id, created_at desc);
create index notifications_goal_idx on public.notifications (goal_id);
alter table public.notifications enable row level security;
create policy notifications_self_select on public.notifications for select using (member_id = (select auth.uid()));

-- ---------- thread and history events ----------
create function private.notify_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_goal text;
  v_partner uuid;
  v_scope jsonb;
  v_actor uuid := new.author_id;
  v_rcpt uuid;
  v_side text;
  v_kind text;
begin
  select g.owner_id, g.commitment into v_owner, v_goal from public.goals g where g.id = new.goal_id;
  select p.partner_id, p.scope into v_partner, v_scope
    from public.goal_partners p where p.goal_id = new.goal_id and p.ended_at is null;

  if new.kind = 'partner_left' then
    -- The partnership has already ended, and the entry is written in the partner's name
    -- whoever ended it. The one who acted is the caller.
    v_partner := new.author_id;
    v_actor := coalesce((select auth.uid()), new.author_id);
  end if;
  if v_owner is null or v_partner is null or v_actor is null then return new; end if;

  if v_actor = v_owner then
    v_rcpt := v_partner;
    v_side := 'partner';
    v_kind := case
      when new.kind in ('checkin', 'completed') and coalesce((v_scope ->> 'checkins')::boolean, false) then new.kind
      when new.kind in ('question', 'reply') then new.kind
      when new.kind = 'partner_left' then 'removed'
    end;
  elsif v_actor = v_partner then
    v_rcpt := v_owner;
    v_side := 'owner';
    v_kind := case
      when new.kind in ('partner_checkin', 'suggestion', 'question', 'reply', 'partner_joined') then new.kind
      when new.kind = 'partner_left' then 'left'
    end;
  end if;
  if v_kind is null then return new; end if;

  insert into public.notifications (member_id, kind, side, goal_id, actor_name, goal_text, body)
  values (v_rcpt, v_kind, v_side, new.goal_id, private.member_name(v_actor), left(v_goal, 140),
          left(coalesce(nullif(trim(new.text), ''), new.responses ->> 'did'), 160));
  return new;
end $$;
revoke all on function private.notify_timeline() from public, anon, authenticated;

create trigger timeline_notify after insert on public.timeline_entries
  for each row execute function private.notify_timeline();

-- ---------- a brother's read on a blocker ----------
create function private.notify_blocker_read() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_goal text;
begin
  if new.partner_id is null
     or (new.partner_view is not distinct from old.partner_view and new.partner_note is not distinct from old.partner_note) then
    return new;
  end if;
  select g.owner_id, g.commitment into v_owner, v_goal from public.goals g where g.id = new.goal_id;
  if v_owner is null or v_owner = new.partner_id then return new; end if;
  insert into public.notifications (member_id, kind, side, goal_id, actor_name, goal_text, body)
  values (v_owner, 'blocker_read', 'owner', new.goal_id, private.member_name(new.partner_id), left(v_goal, 140),
          left(coalesce(new.partner_note, new.text), 160));
  return new;
end $$;
revoke all on function private.notify_blocker_read() from public, anon, authenticated;

create trigger blockers_notify after update on public.blockers
  for each row execute function private.notify_blocker_read();

-- ---------- reading them ----------
create function public.load_notifications() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.notifications n where n.member_id = (select auth.uid()) and n.read_at is null),
    'items', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'side', x.side, 'goalId', x.goal_id, 'actor', x.actor_name,
        'goal', x.goal_text, 'body', x.body, 'at', x.created_at, 'read', x.read_at is not null)) order by x.created_at desc)
      from (select * from public.notifications n where n.member_id = (select auth.uid())
            order by n.created_at desc limit 50) x), '[]'::jsonb))
$$;

create function public.mark_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where member_id = (select auth.uid()) and read_at is null
$$;

revoke all on function public.load_notifications() from public, anon;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.load_notifications() to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;

-- Keep the table small: drop anything older than 90 days, once a day.
select cron.schedule('accountability-notifications-prune', '20 9 * * *',
  $job$ delete from public.notifications where created_at < now() - interval '90 days' $job$);
