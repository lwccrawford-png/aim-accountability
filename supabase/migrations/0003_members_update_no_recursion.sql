-- The members update policy read the members table inside its own check, which
-- Postgres rejects as infinite recursion. A trigger now stops a member from
-- changing his own community role; the policy only checks ownership.

drop policy members_self_update on public.members;
create policy members_self_update on public.members for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function private.members_guard_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.community_role is distinct from old.community_role
     and coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'community role is set by an admin' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.members_guard_role() from public, anon, authenticated;

create trigger members_guard_role before update on public.members
  for each row execute function private.members_guard_role();
