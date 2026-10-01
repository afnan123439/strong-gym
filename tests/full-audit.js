const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const htmlFiles = ['dist/index.html', 'dist/member.html', 'dist/admin.html', 'dist/privacy.html', 'dist/terms.html'];
let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`✗ ${name}\n  ${error.stack || error.message}`);
  }
}

function localRefs(html) {
  return [...html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)]
    .map(match => match[1])
    .filter(value => !/^(?:https?:|mailto:|tel:|data:)/i.test(value));
}

async function main() {
  await check('كل ملفات CSS وJS والصور المشار إليها موجودة', () => {
    for (const file of htmlFiles) {
      const directory = path.dirname(path.join(root, file));
      for (const ref of localRefs(read(file))) {
        const target = path.resolve(directory, ref);
        assert(fs.existsSync(target), `${file}: ${ref}`);
      }
    }
  });

  await check('لا توجد معرفات HTML مكررة داخل أي صفحة', () => {
    for (const file of htmlFiles) {
      const ids = [...read(file).matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      assert.deepStrictEqual([...new Set(duplicates)], [], `${file}: ${duplicates.join(', ')}`);
    }
  });

  await check('روابط الأقسام الداخلية تشير إلى عناصر موجودة', () => {
    for (const file of htmlFiles) {
      const html = read(file);
      const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
      const anchors = [...html.matchAll(/href=["']#([^"']+)["']/g)].map(match => match[1]);
      for (const anchor of anchors) {
        const routedAdminView = html.includes(`data-view="${anchor}"`);
        assert(ids.has(anchor) || routedAdminView, `${file}: #${anchor}`);
      }
    }
  });

  await check('ملف PWA صالح والأيقونات موجودة', () => {
    const manifest = JSON.parse(read('dist/manifest.webmanifest'));
    assert(manifest.name && manifest.short_name && manifest.start_url);
    for (const icon of manifest.icons || []) {
      assert(fs.existsSync(path.resolve(root, 'dist', icon.src)), icon.src);
    }
  });

  await check('ملفات التخزين المؤقت في Service Worker موجودة', () => {
    const worker = read('dist/service-worker.js');
    const core = worker.match(/const CORE\s*=\s*(\[[\s\S]*?\]);/);
    assert(core, 'CORE is missing');
    const files = vm.runInNewContext(core[1]);
    for (const file of files) {
      const relative = file === './' ? 'index.html' : file.replace(/^\.\//, '');
      assert(fs.existsSync(path.join(root, 'dist', relative)), relative);
    }
  });

  await check('مولد الخطط يتحمل جميع الأهداف والمستويات والقيود والأيام', () => {
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(read('dist/assets/program-personalization.js'), context);
    const build = context.window.StrongGymPersonalizer.build;
    let cases = 0;
    for (const goal of ['weight_loss', 'muscle_gain', 'fitness']) {
      for (const level of ['beginner', 'intermediate', 'advanced']) {
        for (const limitation of ['none', 'knee', 'back', 'shoulder', 'cardio']) {
          for (const days of [1, 3, 4, 5, 6, 7]) {
            const result = build({
              member: { id: `member-${cases}`, gender: cases % 2 ? 'male' : 'female' },
              measurement: { weight_kg: cases % 3 ? 78 : null, height_cm: 171 },
              health: { birth_date: cases % 4 ? '1994-06-10' : null, activity_level: 'moderate' },
              goal, level, limitation, days,
              logs: cases % 5 ? [] : [{ completed: true, difficulty: 'hard' }]
            });
            assert.strictEqual(result.workout_plan.length, days);
            assert(result.workout_plan.every(day => day.exercises.length === 4));
            for (const number of [result.daily_calories, result.protein_g, result.carbs_g, result.fats_g, result.water_liters]) {
              assert(Number.isFinite(number) && number > 0, `${goal}/${level}/${limitation}/${days}`);
            }
            cases += 1;
          }
        }
      }
    }
    assert.strictEqual(cases, 270);
  });

  await check('عميل API لا يتوقف عند تلف بيانات الجلسة', async () => {
    const storage = new Map([['strong_gym_session', '{broken-json']]);
    const context = {
      window: {}, location: { origin: 'http://localhost' },
      localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      fetch: async () => { throw new Error('fetch must not run'); },
      Date, JSON, encodeURIComponent, setTimeout, clearTimeout
    };
    vm.createContext(context);
    vm.runInContext(read('dist/assets/supabase-client.js'), context);
    assert.strictEqual(await context.window.StrongGymAPI.session(), null);
    assert.strictEqual(await context.window.StrongGymAPI.profile(), null);
  });

  await check('تسجيل الخروج يمسح الجلسة حتى عند فشل الشبكة', async () => {
    const storage = new Map([['strong_gym_session', JSON.stringify({ access_token: 'token', expires_in: 3600, saved_at: Date.now(), user: { id: 'u1' } })]]);
    const context = {
      window: {}, location: { origin: 'http://localhost' },
      localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      fetch: async () => { throw new Error('offline'); },
      Date, JSON, encodeURIComponent, setTimeout, clearTimeout
    };
    vm.createContext(context);
    vm.runInContext(read('dist/assets/supabase-client.js'), context);
    await context.window.StrongGymAPI.signOut();
    assert(!storage.has('strong_gym_session'));
  });

  await check('طلب إخراج المشترك يستخدم RPC ولا يكشف مفتاحًا سريًا', async () => {
    const token = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: 'manager' })).toString('base64url') + '.';
    const storage = new Map([['strong_gym_session', JSON.stringify({ access_token: token, expires_in: 3600, saved_at: Date.now(), user: { id: 'manager' } })]]);
    const calls = [];
    const context = {
      window: {}, location: { origin: 'http://localhost' },
      localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 204, json: async () => null }; },
      Date, JSON, encodeURIComponent, setTimeout, clearTimeout
    };
    vm.createContext(context);
    vm.runInContext(read('dist/assets/supabase-client.js'), context);
    await context.window.StrongGymAPI.kickMemberSessions('member-1');
    assert.strictEqual(calls.length, 1);
    assert(calls[0].url.endsWith('/rest/v1/rpc/kick_member_sessions'));
    assert.strictEqual(calls[0].options.method, 'POST');
    assert.deepStrictEqual(JSON.parse(calls[0].options.body), { p_member_id: 'member-1' });
    assert(!/service_role|sb_secret_/i.test(read('dist/assets/supabase-client.js')));
  });

  await check('المخطط يفعّل RLS ويمنح أقل صلاحيات لازمة', () => {
    const schema = read('supabase/schema.sql');
    const tables = ['profiles', 'membership_plans', 'subscriptions', 'cash_payments', 'measurements', 'health_profiles', 'notifications', 'audit_log', 'member_programs', 'workout_logs', 'meal_logs'];
    for (const table of tables) assert(schema.includes(`alter table public.${table} enable row level security`), table);
    assert(schema.includes('revoke all on function public.kick_member_sessions(uuid) from public'));
    assert(schema.includes('if not private.is_manager()'));
  });

  console.log(`\n${passed}/${passed + failures.length} full-audit checks passed`);
  if (failures.length) process.exitCode = 1;
}

main();
