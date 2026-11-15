-- Daily caps for the AI helper, so a free model key can't be run dry.
-- No policies: only the edge function (service role) touches this table.

create table public.ai_usage (
  key text not null,      -- 'u:<user id>' or 'ip:<sha256 of ip>'
  day date not null,
  uses integer not null default 0,
  primary key (key, day)
);
alter table public.ai_usage enable row level security;

-- Counts one use if under the cap. Returns uses left after this one, or -1 if capped.
create function public.take_ai_use(p_key text, p_cap integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.ai_usage as a (key, day, uses) values (p_key, current_date, 1)
  on conflict (key, day) do update set uses = a.uses + 1
    where a.uses < p_cap
  returning uses into n;
  if n is null then return -1; end if;
  return p_cap - n;
end $$;
revoke all on function public.take_ai_use(text, integer) from public, anon, authenticated;

grant execute on function public.take_ai_use(text, integer) to service_role;
