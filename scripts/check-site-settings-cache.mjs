// Mocked queries only: node scripts/check-site-settings-cache.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let result;
let cachedQuery;
let cacheOptions;
const errors = [];
const mocks = {
  react: { cache: fn => fn },
  'next/cache': { unstable_cache: (fn, keys, options) => {
    cachedQuery = fn;
    cacheOptions = options;
    return fn;
  } },
  '@/lib/public-data': { CACHE_SECONDS: { long: 86400 }, CACHE_TAGS: { siteSettings: 'site-settings' } },
  '@/lib/site-url': {},
  '@/lib/site-copy': {},
  '@/lib/seo': {},
  '@/lib/supabase/public': { createPublicClient: () => ({ from: table => {
    assert.equal(table, 'site_settings');
    return { select: () => ({ single: async () => result }) };
  } }) },
};
const exports = {};
const code = ts.transpileModule(readFileSync(new URL('../lib/site-settings.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { exports, console: { error: (...args) => errors.push(args) }, require: name => {
  assert.ok(name in mocks, `Unexpected dependency: ${name}`);
  return mocks[name];
} });

assert.equal(cacheOptions.revalidate, 86400);
assert.deepEqual(Array.from(cacheOptions.tags), ['site-settings']);
result = { data: { site_name: 'ARCH.B' }, error: null };
assert.equal((await exports.getSiteSettings()).site_name, 'ARCH.B');
result = { data: null, error: { code: 'PGRST116' } };
assert.equal(await cachedQuery(), null, 'A missing settings row can use defaults');
result = { data: null, error: { code: '08006', message: 'Temporary outage' } };
await assert.rejects(cachedQuery, error => error === result.error, 'Transient failures must escape the persistent cache boundary');
assert.equal(await exports.getSiteSettings(), null, 'The layout still gets its existing request fallback');
assert.equal(errors.length, 1);
result = { data: { site_name: 'Recovered' }, error: null };
assert.equal((await exports.getSiteSettings()).site_name, 'Recovered');
console.log('Site settings cache checks passed: daily TTL, invalidation tag, missing settings, uncached transient failures, layout fallback and recovery. No live data changed.');
