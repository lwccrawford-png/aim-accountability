-- Step 4: the Brotherhood feed.
-- Who's in: signed-in members with LMTLSS mode on. Moderators/admins review reports.
-- Like partner access, members get no table access at all: every read and write
-- goes through a function that checks who's asking first.
-- A post is its own record. It never links to a goal and carries only the words
-- the author typed.

create table public.posts (
  id uuid primary key,
  author_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('win', 'step_of_faith', 'milestone', 'completed')),
  headline text check (char_length(headline) <= 120),
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  hidden_at timestamptz,
  hidden_by uuid references public.members (id) on delete set null
);
create index posts_feed_idx on public.posts (status, created_at desc);
create index posts_author_idx on public.posts (author_id);
create index posts_hidden_by_idx on public.posts (hidden_by);

create table public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('amen', 'proud', 'keep_going')),
  created_at timestamptz not null default now(),
  primary key (post_id, member_id, kind)
);
create index post_reactions_member_idx on public.post_reactions (member_id);

create table public.post_comments (
  id uuid primary key,
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.members (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create index post_comments_author_idx on public.post_comments (author_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references public.members (id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('hidden', 'kept')),
  resolved_by uuid references public.members (id) on delete set null,
  unique (target_type, target_id, reporter_id)
);
create index reports_open_idx on public.reports (resolved_at, created_at);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_resolved_by_idx on public.reports (resolved_by);

alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.reports enable row level security;

-- ---------- helpers ----------
create function private.is_brother() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where id = (select auth.uid()) and lmtlss_mode)
$$;
create function private.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where id = (select auth.uid()) and community_role in ('moderator', 'admin'))
$$;
-- The feed shows the name he chose, never part of his email.
create function private.public_name(m uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(trim(display_name), ''), 'A brother') from public.members where id = m
$$;
revoke all on function private.is_brother() from public, anon;
revoke all on function private.is_moderator() from public, anon;
revoke all on function private.public_name(uuid) from public, anon;
grant execute on function private.is_brother() to authenticated;
grant execute on function private.is_moderator() to authenticated;
grant execute on function private.public_name(uuid) to authenticated;

create function private.require_brother() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_brother() then
    raise exception 'turn on LMTLSS mode to join the Brotherhood' using errcode = '42501';
  end if;
  if not exists (select 1 from public.members where id = (select auth.uid()) and nullif(trim(display_name), '') is not null) then
    raise exception 'set your name first' using errcode = '22023';
  end if;
end $$;
revoke all on function private.require_brother() from public, anon;
grant execute on function private.require_brother() to authenticated;

-- ---------- reading ----------
-- Newest first. A man sees visible posts plus his own; moderators also see hidden ones.
create function public.load_feed(p_before timestamptz default null, p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  is_mod boolean := private.is_moderator();
begin
  if not private.is_brother() and not is_mod then
    raise exception 'turn on LMTLSS mode to join the Brotherhood' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x order by (x ->> 'createdAt') desc) from (
      select jsonb_strip_nulls(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'headline', p.headline, 'body', p.body, 'status', p.status,
        'createdAt', p.created_at, 'editedAt', p.edited_at,
        'author', private.public_name(p.author_id), 'mine', p.author_id = me,
        'reactions', (select jsonb_object_agg(k, n) from (select r.kind k, count(*) n from public.post_reactions r where r.post_id = p.id group by r.kind) c),
        'myReactions', (select jsonb_agg(r.kind) from public.post_reactions r where r.post_id = p.id and r.member_id = me),
        'reported', exists (select 1 from public.reports rp where rp.target_type = 'post' and rp.target_id = p.id and rp.reporter_id = me),
        'comments', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'id', c.id, 'body', c.body, 'createdAt', c.created_at, 'editedAt', c.edited_at, 'status', c.status,
              'author', private.public_name(c.author_id), 'mine', c.author_id = me,
              'reported', exists (select 1 from public.reports rp where rp.target_type = 'comment' and rp.target_id = c.id and rp.reporter_id = me)
            )) order by c.created_at)
            from public.post_comments c
            where c.post_id = p.id and (c.status = 'visible' or c.author_id = me or (is_mod and c.status = 'hidden'))
              and c.status <> 'removed'), '[]'::jsonb)
      )) x
      from public.posts p
      where (p.status = 'visible' or (p.author_id = me and p.status = 'hidden') or (is_mod and p.status = 'hidden'))
        and (p_before is null or p.created_at < p_before)
      order by p.created_at desc
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) q), '[]'::jsonb);
end $$;

-- ---------- writing ----------
create function public.create_post(p_id uuid, p_kind text, p_body text, p_headline text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  perform private.require_brother();
  if exists (select 1 from public.posts where id = p_id) then return jsonb_build_object('id', p_id, 'duplicate', true); end if;
  if (select count(*) from public.posts where author_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'that''s a lot of wins for one day. Share more tomorrow' using errcode = '22023';
  end if;
  insert into public.posts (id, author_id, kind, headline, body)
    values (p_id, me, p_kind, nullif(trim(p_headline), ''), trim(p_body));
  return jsonb_build_object('id', p_id, 'duplicate', false);
end $$;

create function public.edit_post(p_id uuid, p_body text, p_headline text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set body = trim(p_body), headline = nullif(trim(p_headline), ''), edited_at = now()
  where id = p_id and author_id = (select auth.uid()) and status <> 'removed';
  if not found then raise exception 'not your post' using errcode = '42501'; end if;
end $$;

-- Author removes his own; a moderator can remove anything.
create function public.remove_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set status = 'removed'
  where id = p_id and (author_id = (select auth.uid()) or private.is_moderator());
  if not found then raise exception 'not your post' using errcode = '42501'; end if;
end $$;

create function public.react(p_post uuid, p_kind text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_brother();
  if not exists (select 1 from public.posts where id = p_post and status = 'visible') then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.post_reactions (post_id, member_id, kind) values (p_post, (select auth.uid()), p_kind) on conflict do nothing;
  else
    delete from public.post_reactions where post_id = p_post and member_id = (select auth.uid()) and kind = p_kind;
  end if;
end $$;

create function public.add_comment(p_id uuid, p_post uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_brother();
  if not exists (select 1 from public.posts where id = p_post and status = 'visible') then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  insert into public.post_comments (id, post_id, author_id, body) values (p_id, p_post, (select auth.uid()), trim(p_body))
  on conflict (id) do nothing;
end $$;

create function public.edit_comment(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.post_comments set body = trim(p_body), edited_at = now()
  where id = p_id and author_id = (select auth.uid()) and status <> 'removed';
  if not found then raise exception 'not your comment' using errcode = '42501'; end if;
end $$;

create function public.remove_comment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.post_comments set status = 'removed'
  where id = p_id and (author_id = (select auth.uid()) or private.is_moderator());
  if not found then raise exception 'not your comment' using errcode = '42501'; end if;
end $$;

-- ---------- reports + moderation ----------
-- Three reports from different men hide it until a moderator looks.
create function public.report_content(p_type text, p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not private.is_brother() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_type = 'post' and not exists (select 1 from public.posts where id = p_id and status = 'visible') then return; end if;
  if p_type = 'comment' and not exists (select 1 from public.post_comments where id = p_id and status = 'visible') then return; end if;
  insert into public.reports (target_type, target_id, reporter_id, reason)
    values (p_type, p_id, (select auth.uid()), nullif(trim(p_reason), ''))
  on conflict do nothing;
  select count(*) into n from public.reports where target_type = p_type and target_id = p_id and resolved_at is null;
  if n >= 3 then
    if p_type = 'post' then update public.posts set status = 'hidden', hidden_at = now() where id = p_id and status = 'visible';
    else update public.post_comments set status = 'hidden' where id = p_id and status = 'visible';
    end if;
  end if;
end $$;

create function public.list_reports() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by (x ->> 'firstAt')) from (
      select jsonb_strip_nulls(jsonb_build_object(
        'type', r.target_type, 'id', r.target_id, 'count', count(*), 'firstAt', min(r.created_at),
        'reasons', jsonb_agg(r.reason) filter (where r.reason is not null),
        'body', case r.target_type when 'post' then (select p.body from public.posts p where p.id = r.target_id)
                                   else (select c.body from public.post_comments c where c.id = r.target_id) end,
        'headline', case when r.target_type = 'post' then (select p.headline from public.posts p where p.id = r.target_id) end,
        'status', case r.target_type when 'post' then (select p.status from public.posts p where p.id = r.target_id)
                                     else (select c.status from public.post_comments c where c.id = r.target_id) end,
        'author', private.public_name(case r.target_type when 'post' then (select p.author_id from public.posts p where p.id = r.target_id)
                                       else (select c.author_id from public.post_comments c where c.id = r.target_id) end)
      )) x
      from public.reports r where r.resolved_at is null
      group by r.target_type, r.target_id
    ) q), '[]'::jsonb);
end $$;

-- 'hide' takes it down; 'keep' clears the reports and shows it again.
create function public.moderate(p_type text, p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if not private.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_action not in ('hide', 'keep') then raise exception 'bad action' using errcode = '22023'; end if;
  if p_type = 'post' then
    update public.posts set status = case when p_action = 'hide' then 'hidden' else 'visible' end,
      hidden_at = case when p_action = 'hide' then now() end, hidden_by = case when p_action = 'hide' then me end
    where id = p_id and status <> 'removed';
  else
    update public.post_comments set status = case when p_action = 'hide' then 'hidden' else 'visible' end
    where id = p_id and status <> 'removed';
  end if;
  update public.reports set resolved_at = now(), resolution = case when p_action = 'hide' then 'hidden' else 'kept' end, resolved_by = me
  where target_type = p_type and target_id = p_id and resolved_at is null;
end $$;

-- What the app needs to know about me.
create function public.my_community() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', community_role, 'name', display_name, 'inFeed', lmtlss_mode)
  from public.members where id = (select auth.uid())
$$;

-- Grants: signed-in only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.load_feed(timestamptz, integer)', 'public.create_post(uuid, text, text, text)', 'public.edit_post(uuid, text, text)',
    'public.remove_post(uuid)', 'public.react(uuid, text, boolean)', 'public.add_comment(uuid, uuid, text)',
    'public.edit_comment(uuid, text)', 'public.remove_comment(uuid)', 'public.report_content(text, uuid, text)',
    'public.list_reports()', 'public.moderate(text, uuid, text)', 'public.my_community()']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
