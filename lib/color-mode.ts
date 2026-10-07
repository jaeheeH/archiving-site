// This self-contained function also runs in <head>, before the first paint.
export function initializeColorMode(preference?: string | null) {
  if (preference === undefined) {
    try { preference = window.localStorage.getItem('archb-color-mode'); } catch { /* Storage can be disabled. */ }
  }
  const dark = preference === 'dark' || (preference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const chrome = document.querySelector('meta[name="theme-color"]');
  chrome?.setAttribute('content', dark ? '#141717' : chrome.getAttribute('data-light-color') || '#ffffff');
}

export const COLOR_MODE_INIT_SCRIPT = `(${initializeColorMode.toString()})();`;

export function setColorMode(mode: 'light' | 'dark') {
  try { window.localStorage.setItem('archb-color-mode', mode); } catch { /* Keep switching functional without persistence. */ }
  initializeColorMode(mode);
}
