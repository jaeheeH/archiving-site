const DEFAULT_BASE_URL = "https://www.archbehind.com";

function normalizeBaseUrl(value) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
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

async function showBadge(text, color = "#111111") {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1800);
}

async function saveCurrentTab(tab) {
  const stored = await chrome.storage.local.get(["archbToken", "archbBaseUrl"]);
  const token = stored.archbToken;
  const baseUrl = normalizeBaseUrl(stored.archbBaseUrl || DEFAULT_BASE_URL);

  if (!token) {
    await chrome.tabs.create({ url: `${baseUrl}/extension/connect` });
    return;
  }

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

  const response = await fetch(`${baseUrl}/api/extension/references`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: meta.title,
      url: meta.url,
      description: meta.description,
      image_url: meta.image_url,
      logo_url: meta.logo_url,
      category: "미분류",
      range: ["미분류"],
    }),
  });

  if (response.status === 401 || response.status === 403) {
    await chrome.storage.local.remove(["archbToken", "archbTokenExpiresAt", "archbUser"]);
    await chrome.tabs.create({ url: `${baseUrl}/extension/connect` });
    return;
  }

  if (!response.ok) {
    await showBadge("!", "#ff4800");
    return;
  }

  await showBadge("OK", "#111111");
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-archb",
    title: "ARCH-B 레퍼런스로 저장",
    contexts: ["page", "selection", "link", "image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-to-archb" || !tab?.id) return;

  saveCurrentTab(tab).catch(() => {
    showBadge("!", "#ff4800");
  });
});
