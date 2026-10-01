-- Run once in the Supabase SQL Editor for an existing Strong Gym database.
alter table public.profiles add column if not exists force_logout_at timestamptz;

create or replace function public.kick_member_sessions(p_member_id uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare kicked_at timestamptz:=clock_timestamp();
begin
  if not private.is_manager() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.profiles where id=p_member_id and role='member') then raise exception 'member_not_found'; end if;
  update public.profiles set force_logout_at=kicked_at,updated_at=kicked_at where id=p_member_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details_json)
  values((select auth.uid()),'member_sessions_kicked','profile',p_member_id::text,jsonb_build_object('kicked_at',kicked_at));
  return kicked_at;
end $$;

revoke all on function public.kick_member_sessions(uuid) from public,anon;
grant execute on function public.kick_member_sessions(uuid) to authenticated;
