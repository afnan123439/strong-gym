-- Run once in the Supabase SQL Editor before publishing the phone-login frontend.
-- Existing email/password accounts remain valid.
begin;

alter table public.profiles alter column email drop not null;

create unique index if not exists idx_profiles_whatsapp_unique
  on public.profiles (whatsapp_e164)
  where whatsapp_e164 is not null;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare selected_plan bigint; selected_gender public.gender_type; selected_whatsapp text;
begin
  selected_gender:=case when new.raw_user_meta_data->>'gender'='male' then 'male'::public.gender_type else 'female'::public.gender_type end;
  selected_whatsapp:=coalesce(nullif(new.raw_user_meta_data->>'whatsapp_e164',''),new.phone);
  if selected_whatsapp is null then raise exception 'whatsapp_required'; end if;
  insert into public.profiles(id,email,full_name,whatsapp_e164,gender)
  values(new.id,nullif(new.raw_user_meta_data->>'contact_email',''),coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'عضو جديد'),selected_whatsapp,selected_gender);
  select id into selected_plan from public.membership_plans
  where code=coalesce(new.raw_user_meta_data->>'requested_plan','monthly') and active limit 1;
  if selected_plan is not null then insert into public.subscriptions(member_id,plan_id) values(new.id,selected_plan); end if;
  return new;
end $$;

revoke all on function private.handle_new_user() from public;
commit;
