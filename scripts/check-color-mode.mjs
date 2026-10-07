// Run: npx tsx scripts/check-color-mode.mjs [http://localhost:3000]
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import ModeModule from '../lib/color-mode.ts';
const { COLOR_MODE_INIT_SCRIPT, initializeColorMode, setColorMode } = ModeModule;

let saved, systemDark = false, blocked = false, dark, scheme, chrome, lightChrome;
const context = {
  window: {
    localStorage: {
      getItem(key) { assert.equal(key, 'archb-color-mode'); if (blocked) throw Error('Storage blocked'); return saved; },
      setItem(key, value) { assert.equal(key, 'archb-color-mode'); if (blocked) throw Error('Storage blocked'); saved = value; },
    },
    matchMedia: () => ({ matches: systemDark }),
  },
  document: {
    documentElement: { classList: { toggle(name, value) { assert.equal(name, 'dark'); dark = value; } }, style: { set colorScheme(value) { scheme = value; } } },
    querySelector: () => ({ getAttribute: () => lightChrome, setAttribute: (_, value) => { chrome = value; } }),
  },
};
const paint = () => runInNewContext(COLOR_MODE_INIT_SCRIPT, context);
paint(); assert.equal(dark, false); assert.equal(scheme, 'light');
systemDark = true; paint(); assert.equal(dark, true); assert.equal(chrome, '#141717');
saved = 'light'; paint(); assert.equal(dark, false); // An explicit choice overrides the system.
lightChrome = '#ff4800'; paint(); assert.equal(chrome, '#ff4800'); // Preserve the existing browser color setting in light mode.
saved = 'dark'; systemDark = false; paint(); assert.equal(dark, true); // Reload preserves the choice.
saved = 'invalid'; paint(); assert.equal(dark, false);
blocked = true; systemDark = true; paint(); assert.equal(dark, true);
const previousWindow = globalThis.window, previousDocument = globalThis.document;
try {
  globalThis.window = context.window; globalThis.document = context.document;
  setColorMode('light'); assert.equal(dark, false); // A blocked store must not break switching.
  blocked = false; setColorMode('dark'); assert.equal(saved, 'dark');
  initializeColorMode(); assert.equal(dark, true);
} finally { globalThis.window = previousWindow; globalThis.document = previousDocument; }

const palette = readFileSync(new URL('../src/styles/my-design-system-palette.css', import.meta.url), 'utf8');
const darkStart = palette.indexOf('[data-palette="my-design-system"].dark');
const palettes = [palette.slice(0, darkStart), palette.slice(darkStart)];
function luminance(hex) {
  const rgb = hex.match(/\w{2}/g).map(n => parseInt(n, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
for (const p of palettes) {
  const color = role => p.match(new RegExp(`--balsa-color-${role}: (#\\w{6})`))[1];
  for (const [text, background] of [['foreground', 'background'], ['secondary', 'background'], ['muted-foreground', 'surface'], ['primary-foreground', 'primary']]) {
    const [a, b] = [luminance(color(text)), luminance(color(background))].sort((a, b) => b - a);
    assert.ok((a + .05) / (b + .05) >= 4.5, `${text} on ${background} must remain readable`);
  }
}
if (process.argv[2]) {
  const html = await (await fetch(process.argv[2])).text();
  assert.ok(html.includes('archb-color-mode'));
  assert.ok(html.indexOf('archb-color-mode') < html.indexOf('<body'), 'Mode must initialize before content paints');
  const inline = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('archb-color-mode'))?.[1];
  assert.ok(inline, 'The compiled page must include initialization');
  saved = 'dark'; runInNewContext(inline, context); assert.equal(dark, true);
  saved = 'light'; runInNewContext(inline, context); assert.equal(dark, false); assert.equal(chrome, '#ff4800');
}
console.log('Color mode: first paint, system preference, persistence, unavailable storage and palette contrast passed.');
