window.StrongGymAPI=(()=>{
  const url='https://zrhuizelbqjhwfldqopp.supabase.co';
  const key='sb_publishable_uojIYFyAipWRgDEPm2rWpw_0y7qEriU';
  const sessionKey='strong_gym_session';
  const jsonHeaders={'apikey':key,'content-type':'application/json'};
  const readSession=()=>{try{return JSON.parse(localStorage.getItem(sessionKey)||'null')}catch{return null}};
  const saveSession=session=>{if(session)localStorage.setItem(sessionKey,JSON.stringify({...session,saved_at:Date.now()}));else localStorage.removeItem(sessionKey)};
  async function request(path,{method='GET',body,token,headers={}}={}){
    const response=await fetch(url+path,{method,headers:{...jsonHeaders,authorization:`Bearer ${token||key}`,...headers},body:body===undefined?undefined:JSON.stringify(body)});
    const data=response.status===204?null:await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||'تعذر إكمال الطلب');
    return data;
  }
  async function signUp({email,password,fullName,whatsapp,gender,plan}){const redirect=encodeURIComponent(`${location.origin}/index.html?confirmed=1`);return request(`/auth/v1/signup?redirect_to=${redirect}`,{method:'POST',body:{email,password,data:{full_name:fullName,whatsapp_e164:whatsapp,gender,requested_plan:plan==='quarter'?'quarterly':plan}}})}
  async function signIn(email,password){const value=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});saveSession(value);return value}
  async function refresh(){const current=readSession();if(!current?.refresh_token)return null;try{const fresh=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:current.refresh_token}});saveSession(fresh);return fresh}catch{saveSession(null);return null}}
  async function session(){let current=readSession();if(!current)return null;const expiresAt=(current.saved_at||0)+(current.expires_in||3600)*1000;if(Date.now()>expiresAt-60000)current=await refresh();return current}
  async function profile(){const current=await session();if(!current?.access_token)return null;const rows=await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(current.user.id)}&select=id,email,full_name,whatsapp_e164,gender,role,status,language,force_logout_at`,{token:current.access_token});return rows?.[0]||null}
  async function recover(email){return request('/auth/v1/recover',{method:'POST',body:{email}})}
  async function updatePassword(password){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');return request('/auth/v1/user',{method:'PUT',body:{password},token:current.access_token})}
  async function updateOwnProfile(fullName,whatsapp){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');return request('/rest/v1/rpc/update_own_profile',{method:'POST',body:{p_full_name:fullName,p_whatsapp:whatsapp||null},token:current.access_token})}
  async function signOut(){const current=readSession();if(current?.access_token)await request('/auth/v1/logout',{method:'POST',token:current.access_token}).catch(()=>{});saveSession(null)}
  function clearLocalSession(){saveSession(null)}
  async function notifications(){const current=await session();if(!current)return[];return request('/rest/v1/notifications?select=id,type,title_ar,title_en,body_ar,body_en,read_at,created_at&order=created_at.desc&limit=20',{token:current.access_token})}
  async function markNotificationRead(id){const current=await session();return request(`/rest/v1/notifications?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{read_at:new Date().toISOString()},token:current.access_token,headers:{prefer:'return=minimal'}})}
  async function pendingMembers(){const current=await session();if(!current)return[];return request('/rest/v1/profiles?status=eq.pending&role=eq.member&select=id,full_name,email,gender,created_at&order=created_at.asc',{token:current.access_token})}
  async function setMemberStatus(id,status){const current=await session();return request(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{status},token:current.access_token,headers:{prefer:'return=minimal'}})}
  async function kickMemberSessions(id){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');return request('/rest/v1/rpc/kick_member_sessions',{method:'POST',body:{p_member_id:id},token:current.access_token})}
  async function adminData(){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');const token=current.access_token;const [profiles,plans,subscriptions,payments,measurements,programs,healthProfiles]=await Promise.all([
    request('/rest/v1/profiles?role=eq.member&select=id,email,full_name,whatsapp_e164,gender,status,created_at&order=created_at.desc',{token}),
    request('/rest/v1/membership_plans?select=id,code,name_ar,price_ils,duration_days&order=price_ils.asc',{token}),
    request('/rest/v1/subscriptions?select=id,member_id,plan_id,starts_on,ends_on,status,renewal_approved,created_at&order=created_at.desc',{token}),
    request('/rest/v1/cash_payments?select=id,subscription_id,amount_ils,paid_at,note&order=paid_at.desc',{token}),
    request('/rest/v1/measurements?select=id,member_id,height_cm,weight_kg,waist_cm,chest_cm,hips_cm,arm_cm,thigh_cm,recorded_at&order=recorded_at.desc',{token}),
    request('/rest/v1/member_programs?select=*&order=created_at.desc',{token}),
    request('/rest/v1/health_profiles?select=member_id,birth_date,activity_level,goal,medical_notes,updated_at&order=updated_at.desc',{token})
  ]);return{profiles,plans,subscriptions,payments,measurements,programs,health_profiles:healthProfiles}}
  async function memberDashboardData(day=new Date().toISOString().slice(0,10)){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');const token=current.access_token,id=encodeURIComponent(current.user.id);const [subscriptions,measurements,programs,healthProfiles,meals]=await Promise.all([
    request(`/rest/v1/subscriptions?member_id=eq.${id}&select=id,member_id,plan_id,starts_on,ends_on,status,renewal_approved,created_at,plan:membership_plans(id,code,name_ar,price_ils,duration_days)&order=created_at.desc`,{token}),
    request(`/rest/v1/measurements?member_id=eq.${id}&select=id,member_id,height_cm,weight_kg,waist_cm,chest_cm,hips_cm,arm_cm,thigh_cm,recorded_at&order=recorded_at.desc&limit=30`,{token}),
    request(`/rest/v1/member_programs?member_id=eq.${id}&active=eq.true&select=*&limit=1`,{token}),
    request(`/rest/v1/health_profiles?member_id=eq.${id}&select=member_id,birth_date,activity_level,goal,medical_notes,updated_at&limit=1`,{token}),
    request(`/rest/v1/meal_logs?member_id=eq.${id}&logged_on=eq.${day}&select=*&order=created_at.desc`,{token})
  ]);const plans=subscriptions.map(s=>s.plan).filter(Boolean);return{subscriptions,measurements,plans,program:programs[0]||null,health:healthProfiles[0]||null,meals}}
  async function activateCash(subscriptionId,amount,note=''){const current=await session();return request('/rest/v1/rpc/activate_cash_subscription',{method:'POST',body:{p_subscription:subscriptionId,p_amount:Number(amount),p_note:note||null},token:current.access_token,headers:{prefer:'return=minimal'}})}
  async function addMeasurement(values){const current=await session();return request('/rest/v1/measurements',{method:'POST',body:{...values,recorded_by:current.user.id},token:current.access_token,headers:{prefer:'return=minimal'}})}
  async function saveProgram(values){const current=await session();const token=current.access_token;await request(`/rest/v1/member_programs?member_id=eq.${encodeURIComponent(values.member_id)}&active=eq.true`,{method:'PATCH',body:{active:false,updated_at:new Date().toISOString()},token,headers:{prefer:'return=minimal'}});return request('/rest/v1/member_programs',{method:'POST',body:{...values,created_by:current.user.id},token,headers:{prefer:'return=minimal'}})}
  async function memberProgram(){const current=await session();if(!current)return null;const rows=await request(`/rest/v1/member_programs?member_id=eq.${encodeURIComponent(current.user.id)}&active=eq.true&select=*&limit=1`,{token:current.access_token});return rows?.[0]||null}
  async function healthProfile(){const current=await session();if(!current)return null;const rows=await request(`/rest/v1/health_profiles?member_id=eq.${encodeURIComponent(current.user.id)}&select=member_id,birth_date,activity_level,goal,medical_notes,updated_at&limit=1`,{token:current.access_token});return rows?.[0]||null}
  async function saveHealthProfile(values){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');return request('/rest/v1/health_profiles?on_conflict=member_id',{method:'POST',body:{member_id:current.user.id,...values,updated_at:new Date().toISOString()},token:current.access_token,headers:{prefer:'resolution=merge-duplicates,return=representation'}})}
  async function workoutLogs(programId){const current=await session();if(!current||!programId)return[];return request(`/rest/v1/workout_logs?program_id=eq.${encodeURIComponent(programId)}&select=*&order=session_date.desc,created_at.desc&limit=300`,{token:current.access_token})}
  async function saveWorkoutLog(values){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');return request('/rest/v1/workout_logs?on_conflict=member_id,program_id,session_date,day_index,exercise_name',{method:'POST',body:{...values,member_id:current.user.id,updated_at:new Date().toISOString()},token:current.access_token,headers:{prefer:'resolution=merge-duplicates,return=representation'}})}
  async function mealLogs(day=new Date().toISOString().slice(0,10)){const current=await session();if(!current)return[];return request(`/rest/v1/meal_logs?member_id=eq.${encodeURIComponent(current.user.id)}&logged_on=eq.${day}&select=*&order=created_at.desc`,{token:current.access_token})}
  async function addMealLog(values){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');return request('/rest/v1/meal_logs',{method:'POST',body:{...values,member_id:current.user.id},token:current.access_token,headers:{prefer:'return=representation'}})}
  async function deleteMealLog(id){const current=await session();if(!current)throw new Error('انتهت جلسة الدخول');return request(`/rest/v1/meal_logs?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',token:current.access_token,headers:{prefer:'return=minimal'}})}
  return{signUp,signIn,signOut,clearLocalSession,recover,updatePassword,updateOwnProfile,session,profile,notifications,markNotificationRead,pendingMembers,setMemberStatus,kickMemberSessions,adminData,memberDashboardData,activateCash,addMeasurement,saveProgram,memberProgram,healthProfile,saveHealthProfile,workoutLogs,saveWorkoutLog,mealLogs,addMealLog,deleteMealLog};
})();
