/* global chrome */
window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (data?.source !== "archb-extension-connect" || !data.token) return;

  chrome.runtime.sendMessage({ type: "archb-connect", token: data.token, expiresAt: data.expiresAt, user: data.user })
    .then(response => {
      if (response?.success) window.postMessage({ source: "archb-extension-connect-ack", success: true }, window.location.origin);
    }).catch(() => {});
});
