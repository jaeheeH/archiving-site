/* global chrome */
const DEFAULT_BASE_URL = "https://www.archbehind.com";
const refs = Object.fromEntries([
  "connectPanel", "formPanel", "connectButton", "connectBaseUrl", "manualToken", "saveTokenButton",
  "baseUrl", "saveBaseUrl", "refreshPage", "title", "url", "description", "categories",
  "imageUrl", "logoUrl", "previewImage", "previewLogo", "imageHint", "capturePage",
  "saveReference", "clearToken", "status", "connectStatus", "connectionLabel", "resultLink",
].map(id => [id, document.getElementById(id)]));
const state = { token: "", baseUrl: DEFAULT_BASE_URL, tab: null, screenshot: "", range: [], categoriesReady: false, reading: false, saving: false };

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_BASE_URL);
  const trusted = ["https://www.archbehind.com", "https://archbehind.com"].includes(url.origin)
    || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  if (!trusted || url.username || url.password) throw new Error("ARCH-B 운영 주소 또는 http://localhost:포트 주소를 입력해주세요.");
  return url.origin;
}

function validPageUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}

function setStatus(message, error = false) {
  for (const target of [refs.status, refs.connectStatus]) {
    target.textContent = message || "";
    target.dataset.error = String(error);
  }
}

function setConnectedUI(connected) {
  refs.connectPanel.classList.toggle("hidden", connected);
  refs.formPanel.classList.toggle("hidden", !connected);
  refs.connectStatus.classList.toggle("hidden", connected);
}

function selectedCategories() {
  return state.range;
}

function updateSaveState() {
  const range = selectedCategories();
  refs.saveReference.disabled = !state.categoriesReady || state.reading || state.saving || !state.token
    || !refs.title.value.trim() || !validPageUrl(refs.url.value.trim()) || range.length < 1 || range.length > 3
    || !(state.screenshot || validPageUrl(refs.imageUrl.value));
  for (const input of refs.categories.querySelectorAll("input")) input.disabled = state.saving || (range.length >= 3 && !input.checked);
  refs.refreshPage.disabled = state.reading || state.saving;
  refs.capturePage.disabled = !state.tab || state.reading || state.saving;
}

function previewAssets() {
  const image = state.screenshot || refs.imageUrl.value.trim();
  refs.previewImage.classList.toggle("hidden", !image);
  if (image) refs.previewImage.src = image; else refs.previewImage.removeAttribute("src");
  if (validPageUrl(refs.logoUrl.value)) refs.previewLogo.src = refs.logoUrl.value;
  else refs.previewLogo.removeAttribute("src");
  refs.imageUrl.disabled = Boolean(state.screenshot);
  refs.imageHint.textContent = state.screenshot ? "현재 보이는 화면을 캡처했습니다. 등록할 때만 업로드합니다." : "대표 이미지 대신 현재 화면을 캡처할 수도 있습니다.";
  updateSaveState();
}

function collectPageMeta() {
  const absolute = value => {
    if (!value) return "";
    try { const url = new URL(value, document.baseURI); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : ""; }
    catch { return ""; }
  };
  const getMeta = selector => document.querySelector(selector)?.getAttribute("content")?.trim() || "";
  const canonical = absolute(document.querySelector("link[rel='canonical']")?.getAttribute("href") || location.href) || location.href;
  const url = new URL(canonical);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  const icon = document.querySelector("link[rel~='icon']")?.getAttribute("href")
    || document.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href")
    || new URL("/favicon.ico", location.href).href;
  return {
    title: (getMeta("meta[property='og:title']") || getMeta("meta[name='twitter:title']") || document.title || url.hostname).slice(0, 160),
    url: url.href,
    description: (getMeta("meta[property='og:description']") || getMeta("meta[name='description']") || getMeta("meta[name='twitter:description']")).slice(0, 500),
    image_url: absolute(getMeta("meta[property='og:image']") || getMeta("meta[name='twitter:image']")),
    logo_url: absolute(icon),
  };
}

async function captureCurrentPage() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!state.tab || active?.id !== state.tab.id) throw new Error("현재 탭이 바뀌었습니다. 페이지 다시 읽기를 눌러주세요.");
  state.screenshot = await chrome.tabs.captureVisibleTab(state.tab.windowId, { format: "jpeg", quality: 80 });
  refs.imageUrl.value = "";
  previewAssets();
}

async function readCurrentPage() {
  state.reading = true;
  state.tab = null;
  state.screenshot = "";
  updateSaveState();
  refs.resultLink.classList.add("hidden");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !validPageUrl(tab.url)) throw new Error("일반 웹사이트 탭에서 확장 프로그램을 열어주세요. Chrome 설정·새 탭에서는 등록할 수 없습니다.");
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPageMeta });
    const meta = results[0]?.result;
    if (!meta || !validPageUrl(meta.url)) throw new Error("페이지 정보를 읽지 못했습니다.");
    state.tab = tab;
    refs.title.value = meta.title || tab.title || "";
    refs.url.value = meta.url;
    refs.description.value = meta.description || "";
    refs.imageUrl.value = meta.image_url || "";
    refs.logoUrl.value = meta.logo_url || "";
    if (!meta.image_url) await captureCurrentPage();
    previewAssets();
  } finally { state.reading = false; updateSaveState(); }
}

async function clearToken() {
  await chrome.storage.local.remove(["archbToken", "archbTokenExpiresAt", "archbUser"]);
  state.token = "";
  state.categoriesReady = false;
  setConnectedUI(false);
  updateSaveState();
}

async function loadStorage() {
  const stored = await chrome.storage.local.get(["archbToken", "archbBaseUrl", "archbTokenExpiresAt", "archbUser"]);
  state.baseUrl = normalizeBaseUrl(stored.archbBaseUrl || DEFAULT_BASE_URL);
  state.token = stored.archbToken || "";
  if (state.token && (!stored.archbTokenExpiresAt || Date.parse(stored.archbTokenExpiresAt) <= Date.now() || !Number.isFinite(Date.parse(stored.archbTokenExpiresAt)))) {
    await clearToken();
    setStatus("연결이 만료되었습니다. 다시 연결해주세요.", true);
  }
  refs.baseUrl.value = refs.connectBaseUrl.value = state.baseUrl;
  refs.connectionLabel.textContent = (stored.archbUser?.nickname || "ARCH-B") + " · " + new URL(state.baseUrl).host;
  setConnectedUI(Boolean(state.token));
}

async function request(type, payload) {
  const result = await chrome.runtime.sendMessage({ type, payload });
  if (!result) throw new Error("확장 프로그램을 다시 로드하고 연결해주세요.");
  if (result.status === 401 || result.status === 403) {
    await clearToken();
    throw new Error("연결이 만료되었거나 관리 권한이 없습니다. 다시 연결해주세요.");
  }
  if (!result.ok) throw new Error(result.data?.error || "요청에 실패했습니다.");
  return result.data;
}

async function loadCategories() {
  state.categoriesReady = false;
  state.range = [];
  refs.categories.replaceChildren();
  updateSaveState();
  const data = await request("archb-categories");
  if (!data.authenticated) { await clearToken(); throw new Error("토큰을 확인하지 못했습니다. 다시 연결해주세요."); }
  if (!data.categories?.length) throw new Error("등록할 범주가 없습니다. 관리자에서 범주를 먼저 추가해주세요.");
  for (const category of data.categories) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = category.name;
    input.addEventListener("change", () => {
      if (!input.checked) state.range = state.range.filter(name => name !== input.value);
      else if (state.range.length < 3) state.range.push(input.value);
      else input.checked = false;
      updateSaveState();
    });
    label.append(input, document.createTextNode(category.name));
    refs.categories.append(label);
  }
  state.categoriesReady = true;
  updateSaveState();
}

async function saveBaseUrl() {
  const baseUrl = normalizeBaseUrl(refs.baseUrl.value);
  if (baseUrl !== state.baseUrl) {
    await clearToken();
    await chrome.storage.local.set({ archbBaseUrl: baseUrl });
    state.baseUrl = baseUrl;
    refs.baseUrl.value = refs.connectBaseUrl.value = baseUrl;
    setStatus("주소를 변경했습니다. 해당 ARCH-B에서 다시 연결해주세요.");
  }
}

async function connect() {
  const baseUrl = normalizeBaseUrl(refs.connectBaseUrl.value);
  if (baseUrl !== state.baseUrl) await clearToken();
  await chrome.storage.local.set({ archbBaseUrl: baseUrl });
  await chrome.tabs.create({ url: baseUrl + "/extension/connect" });
  window.close();
}

async function saveManualToken() {
  const token = refs.manualToken.value.trim();
  let expiry;
  try {
    const [encoded, signature, extra] = token.split(".");
    const payload = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
    if (!signature || extra || payload.type !== "archb-reference-extension" || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) throw new Error();
    expiry = new Date(payload.exp * 1000).toISOString();
  } catch { throw new Error("유효한 연결 토큰을 붙여넣어주세요."); }
  await chrome.storage.local.set({ archbToken: token, archbBaseUrl: normalizeBaseUrl(refs.connectBaseUrl.value), archbTokenExpiresAt: expiry });
  refs.manualToken.value = "";
  await loadStorage();
  await loadCategories();
  await readCurrentPage();
  setStatus("연결했습니다. 등록할 정보를 확인해주세요.");
}

async function saveReference(event) {
  event.preventDefault();
  if (refs.saveReference.disabled) return;
  const range = selectedCategories();
  const payload = {
    title: refs.title.value.trim(), url: refs.url.value.trim(), description: refs.description.value.trim(),
    image_url: state.screenshot ? "" : refs.imageUrl.value.trim(),
    ...(state.screenshot ? { image_data_url: state.screenshot } : {}), logo_url: refs.logoUrl.value.trim(),
    category: range[0], range,
  };
  state.saving = true;
  updateSaveState();
  setStatus("이미지를 저장하고 참고사이트를 등록하고 있습니다…");
  try {
    const data = await request("archb-save", payload);
    setStatus(data.duplicate ? "이미 등록된 주소입니다. 기존 참고사이트를 확인해주세요." : "참고사이트를 등록했습니다.");
    refs.resultLink.href = state.baseUrl + "/dashboard/contents/references?search=" + encodeURIComponent(payload.url);
    refs.resultLink.classList.remove("hidden");
  } catch (error) { setStatus(error.message || "등록하지 못했습니다. 입력한 정보는 유지됩니다.", true); }
  finally { state.saving = false; updateSaveState(); }
}

function run(action) {
  return (...args) => Promise.resolve().then(() => action(...args)).catch(error => setStatus(error.message || "요청에 실패했습니다.", true));
}
refs.connectButton.addEventListener("click", run(connect));
refs.saveTokenButton.addEventListener("click", run(saveManualToken));
refs.saveBaseUrl.addEventListener("click", run(saveBaseUrl));
refs.clearToken.addEventListener("click", run(async () => { await clearToken(); setStatus("연결을 해제했습니다."); }));
refs.refreshPage.addEventListener("click", run(async () => {
  if (state.token && !state.categoriesReady) await loadCategories();
  await readCurrentPage(); setStatus("페이지 정보를 다시 읽었습니다.");
}));
refs.capturePage.addEventListener("click", run(async () => { await captureCurrentPage(); setStatus("현재 화면을 썸네일로 사용합니다."); }));
refs.formPanel.addEventListener("submit", saveReference);
for (const input of [refs.title, refs.url, refs.imageUrl, refs.logoUrl]) input.addEventListener("input", previewAssets);
refs.previewImage.addEventListener("error", () => setStatus("대표 이미지를 미리 볼 수 없습니다. 현재 화면 캡처를 사용하거나 이미지 주소를 바꿔주세요.", true));

setConnectedUI(false);
run(async () => {
  await loadStorage();
  if (state.token) { await loadCategories(); await readCurrentPage(); }
})();
