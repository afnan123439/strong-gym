begin;

drop policy if exists "health readable" on public.health_profiles;
create policy "health readable" on public.health_profiles for select to authenticated
using(member_id=(select auth.uid()) or private.is_manager());

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in ('subscription_expires_today','subscription_expiring','payment_confirmed','account_approved','coach_message','renewal_requested'));

create table if not exists private.gym_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on table private.gym_settings from public,anon,authenticated;

create or replace function public.activate_cash_subscription(p_subscription uuid,p_amount integer,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_duration integer; v_price integer; v_member uuid; v_role public.app_role; v_start date;
begin
  select role into v_role from public.profiles where id=(select auth.uid());
  if v_role is null or v_role not in ('manager','coach') then raise exception 'not_authorized'; end if;
  select s.member_id,mp.duration_days,mp.price_ils into v_member,v_duration,v_price
  from public.subscriptions s join public.membership_plans mp on mp.id=s.plan_id
  where s.id=p_subscription and s.status='awaiting_payment' for update;
  if v_member is null then raise exception 'subscription_not_found_or_already_paid'; end if;
  if p_amount<>v_price then raise exception 'invalid_amount'; end if;
  insert into public.cash_payments(subscription_id,amount_ils,received_by,note)
  values(p_subscription,p_amount,(select auth.uid()),p_note);
  select greatest(current_date,coalesce(max(ends_on)+1,current_date)) into v_start
  from public.subscriptions
  where member_id=v_member and id<>p_subscription and status='active' and ends_on>=current_date;
  update public.subscriptions set starts_on=v_start,ends_on=v_start+(v_duration-1),status='active'
  where id=p_subscription;
  insert into public.notifications(recipient_id,type,title_ar,title_en,body_ar,body_en,related_entity_type,related_entity_id)
  values(v_member,'payment_confirmed','تم تفعيل اشتراكك','Membership activated','تم تأكيد الدفعة وتفعيل اشتراكك.','Your cash payment was confirmed and your membership was activated.','subscription',p_subscription);
end $$;
revoke all on function public.activate_cash_subscription(uuid,integer,text) from public,anon;
grant execute on function public.activate_cash_subscription(uuid,integer,text) to authenticated;

create or replace function public.request_subscription_renewal()
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_member uuid:=(select auth.uid()); v_previous public.subscriptions%rowtype; v_new uuid;
begin
  if v_member is null or not exists(select 1 from public.profiles where id=v_member and role='member' and status='active') then raise exception 'not_authorized'; end if;
  if exists(select 1 from public.subscriptions where member_id=v_member and status='awaiting_payment') then raise exception 'renewal_already_requested'; end if;
  if exists(select 1 from public.subscriptions where member_id=v_member and status='active' and starts_on>current_date) then raise exception 'renewal_already_scheduled'; end if;
  select * into v_previous from public.subscriptions where member_id=v_member order by coalesce(ends_on,created_at::date) desc,created_at desc limit 1;
  if v_previous.id is null then raise exception 'subscription_not_found'; end if;
  insert into public.subscriptions(member_id,plan_id,status) values(v_member,v_previous.plan_id,'awaiting_payment') returning id into v_new;
  update public.subscriptions set renewal_approved=true where id=v_previous.id;
  insert into public.notifications(recipient_id,type,title_ar,title_en,body_ar,body_en,related_entity_type,related_entity_id)
  select id,'renewal_requested','طلب تجديد اشتراك','Membership renewal requested','طلب أحد المشتركين تجديد اشتراكه. راجع الدفعات المعلقة.','A member requested a renewal. Review pending payments.','subscription',v_new
  from public.profiles where role='manager' and status='active';
  return v_new;
end $$;
revoke all on function public.request_subscription_renewal() from public,anon;
grant execute on function public.request_subscription_renewal() to authenticated;

create or replace function public.get_member_group_link()
returns text language plpgsql stable security definer set search_path=public,private as $$
declare v_member uuid:=(select auth.uid()); v_link text;
begin
  if v_member is null or not exists(select 1 from public.profiles where id=v_member and role='member' and gender='female' and status='active') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.subscriptions where member_id=v_member and status='active' and starts_on<=current_date and ends_on>=current_date) then raise exception 'active_subscription_required'; end if;
  select value into v_link from private.gym_settings where key='women_group_url';
  return v_link;
end $$;
revoke all on function public.get_member_group_link() from public,anon;
grant execute on function public.get_member_group_link() to authenticated;

commit;
