-- Reminders by email, for the man who set the goal and for his accountability partner.
-- One email a day at most per man, sent at the hour he picked in his own time zone,
-- and only when something is newly due. The send-reminders function does the mailing;
-- everything it needs comes from the functions below, which only the server can call.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------- each man's choices ----------
alter table public.members
  add column remind_email boolean not null default true,
  add column remind_hour smallint not null default 8 check (remind_hour between 0 and 23),
  add column remind_partner boolean not null default true,
  add column unsub_token uuid not null default gen_random_uuid();
create unique index members_unsub_token_idx on public.members (unsub_token);

-- ---------- server-only state ----------
-- One row per man per day: the email for that day went out.
create table private.reminder_log (
  member_id uuid not null references public.members (id) on delete cascade,
  local_date date not null,
  items int not null,
  sent_at timestamptz not null default now(),
  primary key (member_id, local_date)
);

-- The shared secret the hourly job presents to the send-reminders function.
create table private.reminder_config (
  id boolean primary key default true check (id),
  secret text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into private.reminder_config default values;

-- A bad time zone on one member must not break the run for everyone.
create function private.safe_tz(tz text) returns text
language sql stable set search_path = '' as $$
  select coalesce((select name from pg_catalog.pg_timezone_names where name = tz), 'America/Chicago')
$$;

-- Remind on the due day, then 1, 3 and 7 days late, then go quiet.
create function private.reminder_fresh(due date, today date) returns boolean
language sql immutable set search_path = '' as $$
  select due is not null and (today - due) in (0, 1, 3, 7)
$$;

-- ---------- who gets an email right now ----------
create function public.reminders_due(p_secret text, p_now timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select secret from private.reminder_config) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (
    with m as (
      -- name is null until he sets one; the email then opens with "Hello,"
      select mm.id, u.email, nullif(trim(mm.display_name), '') as name, mm.unsub_token, mm.remind_partner, mm.remind_hour,
             (p_now at time zone private.safe_tz(mm.time_zone))::date as today,
             extract(hour from p_now at time zone private.safe_tz(mm.time_zone))::int as hr
      from public.members mm join auth.users u on u.id = mm.id
      where mm.remind_email and u.email is not null and u.email_confirmed_at is not null
    ), ready as (
      -- At or after his hour, and nothing sent yet today (so a missed run catches up).
      select * from m
      where hr >= remind_hour
        and not exists (select 1 from private.reminder_log l where l.member_id = m.id and l.local_date = m.today)
    ), own as (
      select r.id as member_id,
             jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'goalId', g.id, 'commitment', g.commitment,
               'checkinDue', case when c.next_due <= r.today then c.next_due end,
               'nextAction', case when g.next_action_date <= r.today then nullif(trim(g.next_action), '') end,
               'nextActionDate', case when nullif(trim(g.next_action), '') is not null and g.next_action_date <= r.today
                                      then g.next_action_date end)) order by g.created_at) as items,
             bool_or(private.reminder_fresh(c.next_due, r.today)
                     or (nullif(trim(g.next_action), '') is not null and private.reminder_fresh(g.next_action_date, r.today))) as fresh
      from ready r
      join public.goals g on g.owner_id = r.id and g.lifecycle = 'active'
      left join public.cadences c on c.goal_id = g.id and c.actor_id = r.id and c.role = 'owner'
      where c.next_due <= r.today
         or (nullif(trim(g.next_action), '') is not null and g.next_action_date <= r.today)
      group by r.id
    ), partner as (
      -- His own check-in on a brother's goal, and a heads-up when the brother has gone
      -- quiet for two days (only if the brother shares his check-ins with him).
      select r.id as member_id,
             jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'goalId', g.id, 'ownerName', private.member_name(g.owner_id), 'commitment', g.commitment,
               'checkinDue', case when pc.next_due <= r.today then pc.next_due end,
               'ownerLateSince', case when (p.scope ->> 'checkins')::boolean and oc.next_due <= r.today - 2
                                      then oc.next_due end)) order by p.accepted_at) as items,
             bool_or(private.reminder_fresh(pc.next_due, r.today)
                     or ((p.scope ->> 'checkins')::boolean and (r.today - oc.next_due) in (2, 7))) as fresh
      from ready r
      join public.goal_partners p on p.partner_id = r.id and p.ended_at is null
      join public.goals g on g.id = p.goal_id and g.lifecycle = 'active'
      left join public.cadences pc on pc.goal_id = g.id and pc.actor_id = r.id and pc.role = 'partner'
      left join public.cadences oc on oc.goal_id = g.id and oc.actor_id = g.owner_id and oc.role = 'owner'
      where r.remind_partner
        and (pc.next_due <= r.today or ((p.scope ->> 'checkins')::boolean and oc.next_due <= r.today - 2))
      group by r.id
    )
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'memberId', r.id, 'email', r.email, 'name', r.name, 'localDate', r.today, 'unsubToken', r.unsub_token,
      'own', o.items, 'partner', pa.items))), '[]'::jsonb)
    from ready r
    left join own o on o.member_id = r.id
    left join partner pa on pa.member_id = r.id
    where coalesce(o.fresh, false) or coalesce(pa.fresh, false)
  );
end $$;

-- Record that today's email went out, so the next hourly run skips him.
create function public.reminders_mark(p_secret text, p_member uuid, p_local date, p_items int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select secret from private.reminder_config) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into private.reminder_log (member_id, local_date, items) values (p_member, p_local, p_items)
  on conflict do nothing;
end $$;

-- The link at the bottom of every reminder. No sign-in needed: the token is the proof.
create function public.reminder_unsubscribe(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.members set remind_email = false, updated_at = now() where unsub_token = p_token;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.reminders_due(text, timestamptz) from public, anon, authenticated;
revoke all on function public.reminders_mark(text, uuid, date, int) from public, anon, authenticated;
grant execute on function public.reminders_due(text, timestamptz) to service_role;
grant execute on function public.reminders_mark(text, uuid, date, int) to service_role;
revoke all on function public.reminder_unsubscribe(uuid) from public;
grant execute on function public.reminder_unsubscribe(uuid) to anon, authenticated, service_role;
revoke all on function private.safe_tz(text) from public, anon, authenticated;
revoke all on function private.reminder_fresh(date, date) from public, anon, authenticated;

-- ---------- hourly job ----------
-- Calls the function five minutes past every hour. Until the function has a sender
-- configured (RESEND_API_KEY, REMINDERS_FROM, APP_URL) it answers "not_configured"
-- and sends nothing.
select cron.schedule('accountability-reminders', '5 * * * *', $job$
  select net.http_post(
    url := 'https://cgajwxzovorjekcjehay.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select secret from private.reminder_config)),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)
$job$);
