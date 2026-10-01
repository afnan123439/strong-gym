const assert = require('assert');

const url = 'https://zrhuizelbqjhwfldqopp.supabase.co';
const key = 'sb_publishable_uojIYFyAipWRgDEPm2rWpw_0y7qEriU';
const required = ['E2E_MANAGER_EMAIL','E2E_MANAGER_PASSWORD','E2E_MEMBER_EMAIL','E2E_MEMBER_PASSWORD'];
const missing = required.filter(name => !process.env[name]);

if (missing.length) {
  console.log(`⊘ Auth E2E skipped; add GitHub secrets: ${missing.join(', ')}`);
  process.exit(0);
}

async function request(path, { method='GET', token=key, body }={}) {
  const response = await fetch(url + path, {
    method,
    headers: { apikey:key, authorization:`Bearer ${token}`, 'content-type':'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function login(email,password) {
  return request('/auth/v1/token?grant_type=password', { method:'POST', body:{email,password} });
}

(async()=>{
  const manager = await login(process.env.E2E_MANAGER_EMAIL, process.env.E2E_MANAGER_PASSWORD);
  const member = await login(process.env.E2E_MEMBER_EMAIL, process.env.E2E_MEMBER_PASSWORD);
  assert(manager.access_token && member.access_token);

  const managerProfile = await request(`/rest/v1/profiles?id=eq.${manager.user.id}&select=id,role,status`, {token:manager.access_token});
  const memberProfile = await request(`/rest/v1/profiles?id=eq.${member.user.id}&select=id,role,status`, {token:member.access_token});
  assert(['manager','coach'].includes(managerProfile[0]?.role));
  assert.strictEqual(memberProfile[0]?.role, 'member');
  assert.strictEqual(memberProfile[0]?.status, 'active');

  const memberVisibleProfiles = await request('/rest/v1/profiles?select=id,role', {token:member.access_token});
  assert.deepStrictEqual(memberVisibleProfiles.map(row=>row.id), [member.user.id]);

  const memberPrograms = await request(`/rest/v1/member_programs?member_id=eq.${member.user.id}&select=member_id`, {token:member.access_token});
  assert(memberPrograms.every(row=>row.member_id === member.user.id));

  await request('/auth/v1/logout', {method:'POST',token:manager.access_token});
  await request('/auth/v1/logout', {method:'POST',token:member.access_token});
  console.log('✓ Auth E2E: manager login, member login, roles, RLS, logout');
})().catch(error=>{console.error(`✗ ${error.message}`);process.exit(1)});

