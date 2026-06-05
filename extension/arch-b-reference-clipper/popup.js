const DEFAULT_BASE_URL = "https://www.archbehind.com";

const refs = {
  connectPanel: document.getElementById("connectPanel"),
  formPanel: document.getElementById("formPanel"),
  connectButton: document.getElementById("connectButton"),
  connectBaseUrl: document.getElementById("connectBaseUrl"),
  saveConnectBaseUrl: document.getElementById("saveConnectBaseUrl"),
  manualToken: document.getElementById("manualToken"),
  saveTokenButton: document.getElementById("saveTokenButton"),
  baseUrl: document.getElementById("baseUrl"),
  saveBaseUrl: document.getElementById("saveBaseUrl"),
  refreshPage: document.getElementById("refreshPage"),
  title: document.getElementById("title"),
  url: document.getElementById("url"),
  description: document.getElementById("description"),
  category: document.getElementById("category"),
  previewImage: document.getElementById("previewImage"),
  previewTitle: document.getElementById("previewTitle"),
  previewUrl: document.getElementById("previewUrl"),
  saveReference: document.getElementById("saveReference"),
  clearToken: document.getElementById("clearToken"),
  status: document.getElementById("status"),
};

let state = {
  token: "",
  baseUrl: DEFAULT_BASE_URL,
  pageMeta: null,
};

function setStatus(message) {
  refs.status.textContent = message || "";
}

function normalizeBaseUrl(value) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function setConnectedUI(connected) {
  refs.connectPanel.classList.toggle("hidden", connected);
  refs.formPanel.classList.toggle("hidden", !connected);
}

function absoluteUrl(value, base) {
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function collectPageMeta() {
  const getMeta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
  const canonical = document.querySelector("link[rel='canonical']")?.href || location.href;
  const title =
    getMeta("meta[property='og:title']") ||
    getMeta("meta[name='twitter:title']") ||
    document.title ||
    canonical;
  const description =
    getMeta("meta[property='og:description']") ||
    getMeta("meta[name='description']") ||
    getMeta("meta[name='twitter:description']");
  const image =
    getMeta("meta[property='og:image']") ||
    getMeta("meta[name='twitter:image']") ||
    document.querySelector("img")?.src ||
    "";
  const icon =
    document.querySelector("link[rel='icon']")?.href ||
    document.querySelector("link[rel='shortcut icon']")?.href ||
    document.querySelector("link[rel='apple-touch-icon']")?.href ||
    "/favicon.ico";

  return {
    title,
    url: canonical,
    description,
    image_url: image,
    logo_url: icon,
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function readCurrentPage() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("현재 탭을 찾을 수 없습니다.");

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: collectPageMeta,
  });

  const meta = {
    ...result,
    url: result?.url || tab.url || "",
    title: result?.title || tab.title || tab.url || "",
  };

  meta.image_url = absoluteUrl(meta.image_url, meta.url);
  meta.logo_url = absoluteUrl(meta.logo_url, meta.url);

  state.pageMeta = meta;
  refs.title.value = meta.title || "";
  refs.url.value = meta.url || "";
  refs.description.value = meta.description || "";
  refs.previewImage.src = meta.image_url || meta.logo_url || "";
  refs.previewTitle.textContent = meta.title || "현재 페이지";
  refs.previewUrl.textContent = meta.url || "";
}

async function loadStorage() {
  const stored = await chrome.storage.local.get([
    "archbToken",
    "archbBaseUrl",
    "archbTokenExpiresAt",
  ]);

  state.token = stored.archbToken || "";
  state.baseUrl = normalizeBaseUrl(stored.archbBaseUrl || DEFAULT_BASE_URL);
  refs.baseUrl.value = state.baseUrl;
  refs.connectBaseUrl.value = state.baseUrl;
  setConnectedUI(Boolean(state.token));
}

async function saveBaseUrl() {
  state.baseUrl = normalizeBaseUrl(refs.baseUrl.value || refs.connectBaseUrl.value);
  refs.baseUrl.value = state.baseUrl;
  refs.connectBaseUrl.value = state.baseUrl;
  await chrome.storage.local.set({ archbBaseUrl: state.baseUrl });
  setStatus("ARCH-B URL을 저장했습니다.");
  await loadCategories();
}

async function saveConnectBaseUrl() {
  state.baseUrl = normalizeBaseUrl(refs.connectBaseUrl.value || refs.baseUrl.value);
  refs.baseUrl.value = state.baseUrl;
  refs.connectBaseUrl.value = state.baseUrl;
  await chrome.storage.local.set({ archbBaseUrl: state.baseUrl });
  setStatus("ARCH-B URL을 저장했습니다.");
}

async function loadCategories() {
  refs.category.innerHTML = `<option value="미분류">미분류</option>`;

  try {
    const response = await fetch(`${state.baseUrl}/api/extension/references`, {
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "카테고리를 불러오지 못했습니다.");

    const categories = data.categories || [];
    refs.category.innerHTML = "";

    if (categories.length === 0) {
      refs.category.append(new Option("미분류", "미분류"));
      return;
    }

    categories.forEach((category) => {
      refs.category.append(new Option(category.name, category.name));
    });
  } catch (error) {
    console.warn(error);
    refs.category.innerHTML = `<option value="미분류">미분류</option>`;
  }
}

async function connect() {
  const baseUrl = normalizeBaseUrl(refs.connectBaseUrl.value || refs.baseUrl.value || state.baseUrl);
  await chrome.storage.local.set({ archbBaseUrl: baseUrl });
  await chrome.tabs.create({ url: `${baseUrl}/extension/connect` });
  window.close();
}

async function saveManualToken() {
  const token = refs.manualToken.value.trim();
  if (!token) {
    setStatus("토큰을 입력해주세요.");
    return;
  }

  await chrome.storage.local.set({
    archbToken: token,
    archbBaseUrl: normalizeBaseUrl(refs.baseUrl.value || state.baseUrl),
  });
  refs.manualToken.value = "";
  await loadStorage();
  await loadCategories();
  setStatus("토큰을 저장했습니다.");
}

async function saveReference() {
  if (!state.token) {
    setStatus("먼저 ARCH-B 확장자를 연결해주세요.");
    setConnectedUI(false);
    return;
  }

  const payload = {
    title: refs.title.value.trim(),
    url: refs.url.value.trim(),
    description: refs.description.value.trim(),
    image_url: state.pageMeta?.image_url || "",
    logo_url: state.pageMeta?.logo_url || "",
    category: refs.category.value || "미분류",
    range: [refs.category.value || "미분류"],
  };

  if (!payload.title || !payload.url) {
    setStatus("제목과 URL은 필수입니다.");
    return;
  }

  refs.saveReference.disabled = true;
  setStatus("저장 중입니다...");

  try {
    const response = await fetch(`${state.baseUrl}/api/extension/references`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      await chrome.storage.local.remove(["archbToken", "archbTokenExpiresAt", "archbUser"]);
      state.token = "";
      setConnectedUI(false);
      throw new Error("연결이 만료되었거나 권한이 없습니다. 다시 연결해주세요.");
    }

    if (!response.ok) throw new Error(data.error || "저장에 실패했습니다.");

    setStatus(data.duplicate ? "이미 저장된 레퍼런스입니다." : "ARCH-B에 저장했습니다.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
  } finally {
    refs.saveReference.disabled = false;
  }
}

async function clearToken() {
  await chrome.storage.local.remove(["archbToken", "archbTokenExpiresAt", "archbUser"]);
  state.token = "";
  setConnectedUI(false);
  setStatus("연결을 해제했습니다.");
}

async function boot() {
  await loadStorage();

  if (state.token) {
    await loadCategories();
    try {
      await readCurrentPage();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "현재 페이지를 읽지 못했습니다.");
    }
  }
}

refs.connectButton.addEventListener("click", connect);
refs.saveConnectBaseUrl.addEventListener("click", saveConnectBaseUrl);
refs.saveTokenButton.addEventListener("click", saveManualToken);
refs.saveBaseUrl.addEventListener("click", saveBaseUrl);
refs.refreshPage.addEventListener("click", async () => {
  try {
    await readCurrentPage();
    setStatus("현재 탭 정보를 다시 읽었습니다.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "현재 페이지를 읽지 못했습니다.");
  }
});
refs.saveReference.addEventListener("click", saveReference);
refs.clearToken.addEventListener("click", clearToken);

boot();
