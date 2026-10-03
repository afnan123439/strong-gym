alter table public.health_profiles
  add column if not exists medical_conditions text[] not null default '{}',
  add column if not exists injuries text[] not null default '{}',
  add column if not exists food_allergies text[] not null default '{}',
  add column if not exists dietary_preferences text[] not null default '{}',
  add column if not exists medical_clearance boolean not null default false,
  add column if not exists requires_review boolean not null default false;

alter table public.health_profiles
  drop constraint if exists health_profiles_conditions_allowed,
  add constraint health_profiles_conditions_allowed check (medical_conditions <@ array['heart','high_blood_pressure','diabetes','pregnancy','recent_surgery','kidney']::text[]),
  drop constraint if exists health_profiles_injuries_allowed,
  add constraint health_profiles_injuries_allowed check (injuries <@ array['knee','back','shoulder','cardio']::text[]),
  drop constraint if exists health_profiles_allergies_allowed,
  add constraint health_profiles_allergies_allowed check (food_allergies <@ array['lactose','gluten','nuts']::text[]),
  drop constraint if exists health_profiles_preferences_allowed,
  add constraint health_profiles_preferences_allowed check (dietary_preferences <@ array['vegetarian']::text[]);

create or replace function private.set_health_review_required() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  new.requires_review := new.medical_conditions && array['heart','high_blood_pressure','diabetes','pregnancy','recent_surgery','kidney']::text[];
  if tg_op='INSERT' or old.medical_conditions is distinct from new.medical_conditions then new.medical_clearance := false; end if;
  return new;
end $$;
drop trigger if exists health_review_guard on public.health_profiles;
create trigger health_review_guard before insert or update of medical_conditions on public.health_profiles for each row execute function private.set_health_review_required();

create or replace function public.review_member_health(p_member uuid,p_cleared boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not private.is_manager() then raise exception 'not_authorized'; end if;
  update public.health_profiles set medical_clearance=p_cleared,updated_at=now() where member_id=p_member;
  if not found then raise exception 'health_profile_not_found'; end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details_json)
  values((select auth.uid()),'health_reviewed','health_profile',p_member::text,jsonb_build_object('cleared',p_cleared));
end $$;
revoke all on function public.review_member_health(uuid,boolean) from public,anon;
grant execute on function public.review_member_health(uuid,boolean) to authenticated;

revoke insert,update on public.health_profiles from authenticated;
grant insert(member_id,birth_date,activity_level,goal,medical_notes,medical_conditions,injuries,food_allergies,dietary_preferences,updated_at) on public.health_profiles to authenticated;
grant update(birth_date,activity_level,goal,medical_notes,medical_conditions,injuries,food_allergies,dietary_preferences,updated_at) on public.health_profiles to authenticated;
