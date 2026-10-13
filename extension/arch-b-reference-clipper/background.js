/* global chrome */

// Keep the token inaccessible to website content scripts.
const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({
    id: "save-to-archb",
    title: "ARCH-B 참고사이트로 등록…",
    contexts: ["page"],
    documentUrlPatterns: ["https://*/*", "http://*/*"],
  }));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-to-archb" || !tab?.id) return;
  chrome.action.openPopup({ windowId: tab.windowId }).catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (["archb-categories", "archb-save"].includes(message?.type)) {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup.html")) return;
    // The worker finishes registration even if the user closes the popup.
    storageReady.then(async () => {
      const stored = await chrome.storage.local.get(["archbToken", "archbBaseUrl"]);
      const url = new URL(stored.archbBaseUrl);
      const trusted = ["https://www.archbehind.com", "https://archbehind.com"].includes(url.origin)
        || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
      if (!trusted || url.username || url.password || !stored.archbToken) throw new Error("ARCH-B에 다시 연결해주세요.");
      const save = message.type === "archb-save";
      const response = await fetch(url.origin + "/api/extension/references", {
        method: save ? "POST" : "GET",
        headers: { Authorization: "Bearer " + stored.archbToken, ...(save ? { "Content-Type": "application/json" } : {}) },
        ...(save ? { body: JSON.stringify(message.payload) } : {}),
        signal: AbortSignal.timeout(55_000),
      });
      const data = await response.json();
      respond({ ok: response.ok, status: response.status, data });
    }).catch(error => respond({ ok: false, status: 0, data: { error: error.message || "ARCH-B 서버에 연결하지 못했습니다." } }));
    return true;
  }
  if (message?.type !== "archb-connect" || sender.id !== chrome.runtime.id || sender.frameId !== 0) return;
  let origin;
  try {
    const url = new URL(sender.url);
    const trusted = ["https://www.archbehind.com", "https://archbehind.com"].includes(url.origin)
      || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
    if (!trusted || url.pathname !== "/extension/connect") return;
    origin = url.origin;
  } catch { return; }

  if (typeof message.token !== "string" || !message.token || message.token.length > 4096
      || !Number.isFinite(Date.parse(message.expiresAt)) || Date.parse(message.expiresAt) <= Date.now()) return;

  storageReady.then(() => chrome.storage.local.set({
    archbToken: message.token,
    archbBaseUrl: origin,
    archbTokenExpiresAt: message.expiresAt,
    archbUser: message.user || null,
  })).then(() => respond({ success: true })).catch(() => respond({ success: false }));
  return true;
});
