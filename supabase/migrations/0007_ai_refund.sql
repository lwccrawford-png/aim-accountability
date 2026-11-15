-- A failed model call gives the use back, so an outage doesn't eat a man's daily ideas.
create function public.give_back_ai_use(p_key text) returns void
language sql security definer set search_path = '' as $$
  update public.ai_usage set uses = greatest(uses - 1, 0) where key = p_key and day = current_date
$$;
revoke all on function public.give_back_ai_use(text) from public, anon, authenticated;
grant execute on function public.give_back_ai_use(text) to service_role;
