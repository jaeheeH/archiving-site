import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import ts from 'typescript';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const root = 'extension/arch-b-reference-clipper/';
function loadTs(path, mocks = {}, globals = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: name => name in mocks ? mocks[name] : require(name), Buffer, URL, AbortSignal, process: { env: {} }, console: { error() {} }, ...globals });
  return loadedModule.exports;
}
const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert(!manifest.host_permissions.includes('<all_urls>'));
assert(manifest.host_permissions.includes('http://localhost/*'));
for (const path of Object.values(manifest.icons)) assert(existsSync(root + path));

const png = await sharp({ create: { width: 1800, height: 1000, channels: 3, background: '#1a8917' } }).png().toBuffer();
let requests = 0, lookups = 0;
const requestMock = (url, options, receive) => {
  requests++;
  options.lookup(url.hostname, {}, (error, ip) => { assert.equal(error, null); assert.equal(ip, '93.184.216.34'); });
  const req = new EventEmitter();
  req.end = () => queueMicrotask(() => {
    const response = Readable.from(url.pathname === '/too-big' ? [Buffer.alloc(200)] : [png]);
    response.statusCode = url.pathname === '/redirect-private' ? 302 : 200;
    response.headers = url.pathname === '/redirect-private' ? { location: 'http://internal.test/private.png' } : { 'content-type': 'image/png' };
    receive(response);
  });
  return req;
};
const assets = loadTs('lib/reference-assets.ts', {
  'node:dns/promises': { lookup: async host => { lookups++; return [{ address: host === 'internal.test' ? '169.254.169.254' : '93.184.216.34', family: 4 }]; } },
  'node:https': { request: requestMock }, 'node:http': { request: requestMock },
});
for (const ip of ['127.0.0.1', '10.1.2.3', '100.64.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '::1', 'fc00::1', '::ffff:127.0.0.1', '2002:7f00:1::']) assert.equal(assets.isPublicReferenceAddress(ip), false, ip);
for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(assets.isPublicReferenceAddress(ip), true, ip);
await assets.readRemoteReferenceImage('https://public.test/image.png', 8 * 1024 * 1024);
const before = requests;
await assert.rejects(assets.readRemoteReferenceImage('http://internal.test/image.png', 1024));
assert.equal(requests, before, 'Private DNS must never be requested');
await assert.rejects(assets.readRemoteReferenceImage('https://public.test/redirect-private', 1024));
assert.equal(requests, before + 1, 'Redirect target must be checked before requesting');
await assert.rejects(assets.readRemoteReferenceImage('https://public.test/too-big', 100));
await assert.rejects(assets.readRemoteReferenceImage('https://user:password@public.test/image.png', 1024));
assert(lookups >= 4);
const captured = 'data:image/png;base64,' + png.toString('base64');
assert.deepEqual(assets.readCapturedReferenceImage(captured), png);
assert.throws(() => assets.readCapturedReferenceImage('data:text/html;base64,PHNjcmlwdD4='));
assert.throws(() => assets.readCapturedReferenceImage('data:image/png;base64,abc'));
await assert.rejects(assets.referenceImageWebp(Buffer.from('<svg/>'), 'thumbnail'));
const webp = await assets.referenceImageWebp(png, 'thumbnail');
const metadata = await sharp(webp).metadata();
assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 1280);

const referenceUtils = loadTs('lib/supabase/reference-utils.ts', { '@/lib/supabase/server': {} });
const tokens = loadTs('lib/extension-token.ts', {}, { process: { env: { EXTENSION_TOKEN_SECRET: 'unit-test-only-secret' } } });
const token = tokens.issueExtensionToken({ userId: 'test-admin', role: 'admin' }).token;
assert.equal(tokens.verifyExtensionToken(token).sub, 'test-admin');
assert.equal(tokens.verifyExtensionToken(token + 'changed'), null);
assert.equal(tokens.verifyExtensionToken(tokens.issueExtensionToken({ userId: 'test-admin', role: 'admin', expiresInDays: -1 }).token), null);
let role = 'admin', existing = null, insert = null, uploads = [], invalidated = [];
const names = ['UI/UX', '브랜딩', '디자인', '개발'];
const admin = {
  from(table) {
    let values = [];
    const query = {
      select() { return query; }, eq() { return query; }, limit() { return query; },
      in(_key, items) { values = items; return query; },
      order() { return Promise.resolve({ data: names.map(name => ({ name })), error: null }); },
      then(resolve) { return Promise.resolve({ data: names.filter(name => values.includes(name)).map(name => ({ name })), error: null }).then(resolve); },
      maybeSingle() { return Promise.resolve({ data: existing && values.includes(existing.url) ? existing : null, error: null }); },
      insert(data) { insert = data; return query; },
      single() { return Promise.resolve({ data: table === 'users' ? { role } : { id: 99, ...insert }, error: null }); },
    };
    return query;
  },
  storage: { from() { return {
    upload: async (path, buffer, options) => { uploads.push({ path, buffer, options }); return { error: null }; },
    getPublicUrl: path => ({ data: { publicUrl: 'https://storage.test/' + path } }),
  }; } },
};
const route = loadTs('app/api/extension/references/route.ts', {
  '@/lib/upload-image': loadTs('lib/upload-image.ts', { './image-variants': loadTs('lib/image-variants.ts', {
    '@/research/home-images.json': JSON.parse(readFileSync('research/home-images.json', 'utf8')),
    './public-image': loadTs('lib/public-image.ts'),
  }) }),
  '@/lib/error-message': { getErrorMessage: error => error.message },
  '@/lib/extension-token': tokens,
  '@/lib/public-data': { CACHE_TAGS: { references: 'references', home: 'home' } },
  '@/lib/supabase/admin': { createAdminClient: () => admin },
  '@/lib/supabase/reference-utils': referenceUtils,
  '@/lib/reference-assets': { ...assets, readRemoteReferenceImage: async url => { if (url.includes('favicon.ico')) throw new Error('ICO unsupported'); return png; } },
  'next/cache': { revalidateTag: tag => invalidated.push(tag) },
});
const body = { title: '디자인 참고', url: 'https://design.test/#work', description: '프로젝트를 살펴볼 수 있는 사이트', range: ['브랜딩', '디자인'], image_data_url: captured, logo_url: 'https://design.test/favicon.ico' };
const post = (data, bearer = token) => route.POST(new Request('http://localhost:3002/api/extension/references', { method: 'POST', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }));
assert.equal((await post(body, 'invalid')).status, 401);
role = 'user'; assert.equal((await post(body)).status, 403); role = 'admin';
for (const range of [[], names, ['없는 범주'], ['UI/UX', 'UI/UX']]) assert.equal((await post({ ...body, range })).status, 400);
assert.equal((await post({ ...body, url: 'javascript:alert(1)' })).status, 400);
assert.equal((await post({ ...body, url: 'https://secret:password@design.test' })).status, 400);
assert.equal((await post({ ...body, image_data_url: 'data:image/png;base64,' + Buffer.from('invalid image').toString('base64') })).status, 400);
assert.equal(insert, null); assert.equal(uploads.length, 0);
const saved = await post(body); assert.equal(saved.status, 200);
assert.equal((await saved.json()).duplicate, false);
assert.equal(insert.url, 'https://design.test/'); assert.equal(insert.author, 'test-admin');
assert.deepEqual(Array.from(insert.range), ['브랜딩', '디자인']); assert.equal(insert.category, '브랜딩');
assert.equal(uploads.length, 10);
const originals = uploads.filter(upload => upload.options.contentType === 'image/png');
assert.equal(originals.length, 2); assert(originals.every(upload => upload.buffer.equals(png)), 'Preserve uploaded/captured original bytes');
assert.equal(uploads.filter(upload => upload.options.contentType === 'image/webp').length, 8);
assert.deepEqual(invalidated, ['references', 'home']);
existing = { id: 11, url: 'https://design.test' }; insert = null;
assert.equal((await (await post(body)).json()).duplicate, true);
assert.equal(insert, null); assert.equal(uploads.length, 10, 'Duplicates must not re-upload assets');
const categoriesResponse = await route.GET(new Request('http://localhost:3002/api/extension/references'));
assert.equal(categoriesResponse.headers.get('Cache-Control'), 'private, no-store');
assert.equal((await categoriesResponse.json()).authenticated, false);

// Run the actual popup metadata collector against relative URLs and a base element.
const popupCode = readFileSync(root + 'popup.js', 'utf8');
const collector = popupCode.slice(popupCode.indexOf('function collectPageMeta()'), popupCode.indexOf('async function captureCurrentPage()'));
const elements = {
  "link[rel='canonical']": '/projects/?utm_source=feed&filter=web#top',
  "meta[property='og:title']": '상대 주소 사이트', "meta[name='description']": '소개',
  "meta[property='og:image']": 'images/cover.png', "link[rel~='icon']": 'icons/site.png',
};
const meta = runInNewContext(collector + '\ncollectPageMeta()', {
  URL, location: { href: 'https://design.test/projects/current' },
  document: { baseURI: 'https://design.test/assets/', title: '문서', querySelector: key => key in elements ? { getAttribute: () => elements[key] } : null },
});
assert.equal(meta.url, 'https://design.test/projects/?filter=web');
assert.equal(meta.image_url, 'https://design.test/assets/images/cover.png');
assert.equal(meta.logo_url, 'https://design.test/assets/icons/site.png');
const noImage = runInNewContext(collector + '\ncollectPageMeta()', {
  URL, location: { href: 'https://design.test/' },
  document: { baseURI: 'https://design.test/', title: '이미지 없는 사이트', querySelector: () => null },
});
assert.equal(noImage.image_url, '', 'Missing OG image must trigger capture, not use the page URL as an image');
assert.equal(noImage.logo_url, 'https://design.test/favicon.ico');

// Website messages cannot select another destination or read extension storage.
let listener, connected, ack, fetchCalls = 0;
const chrome = {
  storage: { local: { setAccessLevel: async options => assert.equal(options.accessLevel, 'TRUSTED_CONTEXTS'), set: async data => { connected = data; }, get: async () => connected } },
  runtime: { id: 'test-extension', getURL: path => 'chrome-extension://test-extension/' + path, onInstalled: { addListener() {} }, onMessage: { addListener: handler => { listener = handler; } } },
  contextMenus: { onClicked: { addListener() {} } },
};
runInNewContext(readFileSync(root + 'background.js', 'utf8'), { chrome, URL, Date, console, AbortSignal, fetch: async url => { fetchCalls++; assert.equal(url, 'http://localhost:3002/api/extension/references'); return { ok: true, status: 200, json: async () => ({ success: true }) }; } });
const message = { type: 'archb-connect', token: 'test-token', expiresAt: new Date(Date.now() + 60_000).toISOString(), siteUrl: 'https://evil.test' };
const sender = { id: 'test-extension', frameId: 0, url: 'http://localhost:3002/extension/connect' };
assert.equal(listener(message, { ...sender, url: 'https://evil.test/extension/connect' }, () => {}), undefined);
assert.equal(listener(message, { ...sender, frameId: 1 }, () => {}), undefined);
await new Promise(resolve => listener(message, sender, response => { ack = response; resolve(); }));
assert.equal(ack.success, true); assert.equal(connected.archbBaseUrl, 'http://localhost:3002');
assert.equal(listener({ type: 'archb-save', payload: body }, sender, () => {}), undefined);
assert.equal(fetchCalls, 0);
await new Promise(resolve => listener({ type: 'archb-save', payload: body }, { id: 'test-extension', url: chrome.runtime.getURL('popup.html') }, () => resolve()));
assert.equal(fetchCalls, 1);

// A token response alone must not claim that Chrome is connected.
let effect, intervalCallback, receivedPayload, cleared = false, stateIndex = 0;
const states = [], handlers = {};
const connectWindow = { location: { origin: 'http://localhost:3002' },
  addEventListener: (name, handler) => { handlers[name] = handler; },
  removeEventListener: name => { delete handlers[name]; },
  postMessage: payload => { receivedPayload = payload; },
};
const connectClient = loadTs('app/extension/connect/ExtensionConnectClient.tsx', {
  react: { useEffect: handler => { effect = handler; }, useState: value => { const index = stateIndex++; states[index] = value; return [value, next => { states[index] = next; }]; } },
  'next/link': () => null,
}, {
  window: connectWindow,
  setInterval: callback => { intervalCallback = callback; return 1; }, clearInterval: () => { cleared = true; },
  fetch: async () => ({ status: 200, ok: true, json: async () => ({ token: 'unit-test-only-token', siteUrl: 'https://www.archbehind.com' }) }),
});
connectClient.default();
const cleanup = effect();
await new Promise(resolve => setImmediate(resolve));
assert.equal(states[0], 'ready');
intervalCallback(); assert.equal(receivedPayload.siteUrl, 'http://localhost:3002');
handlers.message({ source: connectWindow, origin: 'https://evil.test', data: { source: 'archb-extension-connect-ack', success: true } });
assert.equal(states[0], 'ready');
handlers.message({ source: connectWindow, origin: 'http://localhost:3002', data: { source: 'archb-extension-connect-ack', success: true } });
assert.equal(states[0], 'connected'); assert.equal(cleared, true);
cleanup(); assert.equal(handlers.message, undefined);
console.log('PASS: manifest, page metadata, connection origin/acknowledgement, token expiry, roles, categories, capture/WebP storage, duplicate registration, private-host/redirect/size protection');
