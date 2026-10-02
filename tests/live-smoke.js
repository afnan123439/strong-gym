const assert = require('assert');
const fs = require('fs');
const path = require('path');

const site = process.env.STRONG_GYM_URL || 'https://strong-gym.s12323888.workers.dev';
const expectedCache = process.env.EXPECTED_CACHE;
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'supabase-client.js'), 'utf8');
const supabaseUrl = apiSource.match(/const url='([^']+)'/)?.[1];
const publishableKey = apiSource.match(/const key='([^']+)'/)?.[1];
let passed = 0;

async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}\n  ${error.message}`); process.exitCode = 1; }
}

async function get(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

(async () => {
  await check('الصفحة الرئيسية المنشورة تعمل', async () => {
    const response = await get(`${site}/`);
    assert.strictEqual(response.status, 200);
    assert((response.headers.get('content-type') || '').includes('text/html'));
    assert((await response.text()).includes('STRONG'));
  });

  await check('كل صفحات التطبيق المنشورة تعمل والنسخة الجديدة وصلت', async () => {
    for (const file of ['index.html', 'member.html', 'admin.html', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'service-worker.js']) {
      const response = await get(`${site}/${file}`);
      assert.strictEqual(response.status, 200, `${file}: ${response.status}`);
      if (file === 'member.html') assert((await response.text()).includes('id="myProgram" class="anchor-target"'), 'member.html is still the old deployment');
      if (file === 'service-worker.js') {
        const worker = await response.text();
        assert(worker.includes('strong-gym-v'), 'service worker cache is missing');
        if (expectedCache) assert(worker.includes(expectedCache), `expected deployed cache ${expectedCache}`);
      }
    }
  });

  await check('ملفات JavaScript وCSS والصور الأساسية المنشورة تعمل', async () => {
    for (const file of [
      'assets/styles.css',
      'assets/dashboard.css',
      'assets/app.js',
      'assets/dashboard-core.js',
      'assets/dashboard-admin.js',
      'assets/dashboard-training.js',
      'assets/dashboard-member.js',
      'assets/error-monitoring.js',
      'assets/program-personalization.js',
      'assets/frontend-enhancements.js',
      'assets/supabase-client.js',
      'assets/strong-gym-logo.jpeg',
      'assets/exercises/exercise-atlas.jpg'
    ]) {
      const response = await get(`${site}/${file}`);
      assert.strictEqual(response.status, 200, `${file}: ${response.status}`);
      const size = Number(response.headers.get('content-length') || 0);
      if (size) assert(size > 50, `${file}: empty response`);
    }
  });

  await check('Supabase Data API متاح للخطط العامة', async () => {
    assert(supabaseUrl && publishableKey);
    const response = await get(`${supabaseUrl}/rest/v1/membership_plans?select=code,name_ar,price_ils`, { headers: { apikey: publishableKey, authorization: `Bearer ${publishableKey}` } });
    assert.strictEqual(response.status, 200);
    const rows = await response.json();
    assert(Array.isArray(rows) && rows.length >= 1);
  });

  await check('بيانات المشتركين لا تتسرب للزائر غير المسجل', async () => {
    const response = await get(`${supabaseUrl}/rest/v1/profiles?select=id,email,full_name`, { headers: { apikey: publishableKey, authorization: `Bearer ${publishableKey}` } });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), []);
  });

  await check('إخراج المشترك مرفوض دون جلسة مدير', async () => {
    const response = await get(`${supabaseUrl}/rest/v1/rpc/kick_member_sessions`, {
      method: 'POST',
      headers: { apikey: publishableKey, authorization: `Bearer ${publishableKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_member_id: '00000000-0000-0000-0000-000000000000' })
    });
    assert(!response.ok, `unexpected ${response.status}`);
  });

  console.log(`\n${passed}/6 live checks passed`);
})();
